#!/bin/sh
# test_ingest.sh - independent smoke/acceptance test for the ingest
# collector.  Generates a deterministic spool with the tools generator,
# runs mrd_ingest into a fresh SQLite store, and asserts that rows
# landed and that exactly the expected station set is present.  Also
# exercises mrd_replay against the same store.
#
# Run from the ingest/ directory (or via `make test`).  Exits nonzero
# on any failure; prints PASS/FAIL and the row count.
#
# S. Bauer, 2021-11.

set -u

# Resolve paths relative to this script so it works from make or a
# direct invocation.
here=$(cd "$(dirname "$0")" && pwd)          # .../ingest/test
ingest_dir=$(cd "$here/.." && pwd)           # .../ingest
root=$(cd "$ingest_dir/.." && pwd)           # repo root (has tools/)

SPOOL=/tmp/spool.bin
DB=/tmp/test.db
INGEST="$ingest_dir/mrd_ingest"
REPLAY="$ingest_dir/mrd_replay"
GEN="$root/tools/gen_packets.py"

EXPECTED="BRANTFRD CAMBRIDG GUELPH KITCHNER MILTON WATERLOO"

fail() {
    echo "FAIL: $1"
    exit 1
}

# Preconditions.
[ -x "$INGEST" ] || fail "mrd_ingest not built at $INGEST (run make first)"
[ -x "$REPLAY" ] || fail "mrd_replay not built at $REPLAY (run make first)"
[ -f "$GEN" ]    || fail "generator not found at $GEN"
command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 not on PATH"
command -v python3 >/dev/null 2>&1 || fail "python3 not on PATH"

# Fresh store each run.
rm -f "$SPOOL" "$DB"

echo "generating spool ..."
python3 "$GEN" "$SPOOL" || fail "gen_packets.py failed"
[ -s "$SPOOL" ] || fail "spool is empty"

echo "running mrd_ingest ..."
"$INGEST" "$SPOOL" "$DB" || fail "mrd_ingest returned nonzero"
[ -f "$DB" ] || fail "store db was not created"

# Row count must be positive.
COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM reading;")
echo "row count: $COUNT"
[ -n "$COUNT" ] || fail "could not read row count"
[ "$COUNT" -gt 0 ] || fail "no rows inserted"

# Station set must be exactly the expected six.
GOT=$(sqlite3 "$DB" "SELECT DISTINCT stnid FROM reading ORDER BY stnid;" | tr '\n' ' ' | sed 's/  */ /g; s/ $//')
echo "stations: $GOT"
[ "$GOT" = "$EXPECTED" ] || fail "station set mismatch: got [$GOT] want [$EXPECTED]"

# Sanity: no NULL core channels, humidity within 0..100 for stored rows.
BADRH=$(sqlite3 "$DB" "SELECT COUNT(*) FROM reading WHERE rh < 0 OR rh > 100;")
[ "$BADRH" = "0" ] || echo "note: $BADRH rows have out-of-range rh (stored, flagged by QC)"

# mrd_replay must read the store back and emit a header + one row per
# station (6 data rows + 1 header = 7 lines).
echo "running mrd_replay ..."
SUMLINES=$("$REPLAY" "$DB" | wc -l | tr -d ' ')
echo "replay summary lines: $SUMLINES"
[ "$SUMLINES" -ge 7 ] || fail "mrd_replay summary too short ($SUMLINES lines)"

# Daily replay row count should match the store row count.
DAILY=$("$REPLAY" "$DB" --daily | tail -n +2 | wc -l | tr -d ' ')
echo "replay daily rows: $DAILY"
[ "$DAILY" = "$COUNT" ] || fail "replay daily rows ($DAILY) != store rows ($COUNT)"

echo "PASS: rows=$COUNT stations=[$GOT]"
exit 0
