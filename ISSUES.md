# Meridian open issues

Exported from the tracker 2026-02-19.  Only open items are listed.

| ID      | Opened     | Component | Severity | Summary |
|---------|------------|-----------|----------|---------|
| MRD-77  | 2012-03-14 | ingest    | major    | Collector shells out to `sqlite3` instead of linking the library. Same in the Java layer. Was meant to be temporary. |
| MRD-91  | 2013-01-08 | analytics | minor    | Soil parameters are hard coded in `deck.py`. The 2008 schema has nowhere to put them. |
| MRD-118 | 2014-06-30 | model     | major    | cropmod assumes daily records are in ascending DOY order and does not check. Out of order decks give silently wrong water balance. |
| MRD-143 | 2016-09-02 | analytics | critical | Output parser must read by column. A whitespace split drops days when SW overflows its field. Took two seasons to find. Fixed in the parser, not in the model. |
| MRD-166 | 2017-11-21 | services  | major    | `ForecastHandler` and `SeriesHandler` build SQL by string concatenation from query parameters. Currently mitigated only by the portal being internal. |
| MRD-181 | 2019-04-03 | dashboard | minor    | Console has no build step, so no charting library. The DOM bar chart in `dashboard.js` was a stopgap. |
| MRD-201 | 2020-08-17 | analytics | major    | cropmod reads and writes fixed filenames in its CWD, so runs cannot be parallelised. The nightly batch takes four hours. |
| MRD-204 | 2021-02-11 | model     | major    | `WATBAL` and `GROWTH` compute the water stress fraction differently. WATBAL uses SW/SWMAX; GROWTH uses SW/(AWC*100). These disagree whenever rooting depth is not 1000 mm. |
| MRD-219 | 2023-06-05 | dashboard | major    | The 2023 rewrite in `ui-next/` covers 3 of 11 screens and is stalled. Both consoles are deployed. |
| MRD-227 | 2024-10-30 | ingest    | minor    | Station id is space padded in the frame and trimmed by hand in `tsstore.c`. Ids containing trailing spaces are indistinguishable from padded ids. |
| MRD-231 | 2025-03-12 | model     | major    | Request from Agronomy to port cropmod off Fortran. No validation harness exists, so nobody has been able to say what "the same answer" would mean. |
| MRD-238 | 2025-11-14 | reporting | major    | The report writer selects the current forecast per station with `MAX(run_at)` compared as text. A manual backfill written in a different timestamp format sorts wrong, so a report can print an older run as the one "in force". |
