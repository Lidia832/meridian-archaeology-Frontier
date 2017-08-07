# Meridian Reporting Subsystem

Fixed-format report writer for the Provincial Agri-Environmental
Monitoring programme's yield-forecast pipeline ("Meridian"). It reads the
forecast store the analytics subsystem produces and prints the
operational reports the ministry files on paper.

This is the newest corner of the Meridian pipeline. It replaced a COBOL
report writer (`RPTGEN`) that had run since the early 1990s; the 1997
plaintext rewrite deliberately kept the fixed-format output close enough
that a decade of archived printouts still line up column-for-column with
what this package prints today. That column fidelity is the whole point —
the filing system *is* column positions on paper.

## What it reads

The immutable SQLite store defined in `docs/CONTRACTS.md`:

    reading(stnid, year, doy, tmax, tmin, rain, srad, rh, wind, flags)
    forecast(stnid, year, run_at, yield_t, ndays, model)
    forecast_daily(stnid, year, doy, sw, et, drain, biom, lai)

Reporting opens the store **read-only** and never creates, alters or
writes any table. The schema belongs to the collector (C) and the
analytics subsystem (Python); we only `SELECT`.

## Reports

| name      | what it shows                                                     |
|-----------|-------------------------------------------------------------------|
| `season`  | one year, every station's forecast yield, ranked, with a          |
|           | provincial total and mean                                         |
| `station` | one station across all years: yield trend, days, model version    |
| `daily`   | the `forecast_daily` series for a station/year, fixed-width table  |
| `anomaly` | readings flagged suspect (`flags & 0x1`), counts per station      |
| `coverage`| station × year grid of which forecasts exist and where gaps are   |

## Usage

    python -m reporting <report> [options]

Options:

    --db PATH            SQLite forecast store (default $MERIDIAN_DB or meridian.sqlite)
    -s, --station STNID  station id, e.g. GUELPH
    -y, --year YYYY      crop year
    -w, --width COLS     page width: 80 (greenbar) or 132 (wide fan-fold)
    -f, --format FMT     text (fixed-format, default) or csv (spreadsheet)
    -o, --output FILE    write to FILE instead of stdout
    --no-paginate        drop page headers/footers/form-feeds (text only)
    --note TEXT          free-text note stamped into the banner
    --list               list the reports and exit

Examples:

    python -m reporting season --year 2021 --db meridian.sqlite
    python -m reporting station --station GUELPH --width 132
    python -m reporting daily -s WATERLOO -y 2021 -w 132 -o waterloo2021.txt
    python -m reporting anomaly --year 2021
    python -m reporting coverage --format csv

## Layout

    reporting/
      db.py          read-only sqlite3 accessor + typed row records
      config.py      ReportConfig — one run's parameters
      constants.py   station roster, long names, units, flag bits
      version.py     version stamp printed in footers
      format/        the fixed-format engine
        numfmt.py    per-field numeric/text formatting (right-align, overflow)
        columns.py   Column / ColumnSet — declarative table layout
        banner.py    the letterhead block
        layout.py    pagination, running headers, footers, form feeds
        emitters.py  ReportDocument/Block + plaintext and CSV emitters
      reports/       one module per report, wired through registry.py
      cli.py         argparse front end
      tests/         pytest tests against a throwaway sqlite store

## Fixed-format conventions

- Numeric fields are right-justified to an exact width. A value that will
  not fit prints as a run of asterisks (`*****`), never a truncated
  number — the same convention the crop-model output uses
  (`docs/OUTFMT.txt`, MRD-143).
- A missing (NULL) value prints as a right-justified `.` to distinguish
  it from a genuine zero.
- Text labels that run long are clipped with a trailing `>`.
- The plaintext emitter is the real product. CSV is a convenience for the
  spreadsheet users (added 2004) and is explicitly **not** fixed-format —
  do not parse the plaintext, ask for CSV.

## Tests

    python -m pytest reporting/tests -q

The tests build a throwaway SQLite store (three stations, two years, a
short daily series, a couple of suspect readings) and assert each report
renders and its headline numbers are right.

## History (abbrev.)

- 1997 — plaintext rewrite; retired the COBOL `RPTGEN` writer
- 2004 — CSV emitter (R. Halloran)
- 2011 — package restructure, argparse CLI
- 2018 — season-summary rewrite (R. Halloran)
- 2021 — 132-column layout, pagination extracted, registry (P. Adeyemi)
- 2023 — coverage and anomaly reports (P. Adeyemi)
