#!/bin/sh
# Bring up a local Meridian. Not how it is deployed in production.
set -e
cd "$(dirname "$0")"

DB=data/meridian.db
SPOOL=data/spool_2025.bin

# The data directory is not tracked (its contents are generated). Make sure it
# exists on a fresh checkout before anything tries to write into it.
mkdir -p "$(dirname "$DB")"

if [ ! -f "$SPOOL" ]; then
  echo "generating spool"
  python3 tools/gen_packets.py "$SPOOL"
fi

echo "ingesting"
./ingest/mrd_ingest "$SPOOL" "$DB"

echo "running forecast"
python3 analytics/run_forecast.py --db "$DB"

echo "starting api on 8081"
java -cp services/build/classes -Dmeridian.db="$DB" -Dmeridian.port=8081 \
     ca.meridian.api.ApiServer &

echo "starting console on 8080"
node dashboard/server.js
