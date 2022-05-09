# Meridian inter-subsystem contracts (IMMUTABLE — do not change)

These interfaces are shared across subsystems. Any subsystem may grow internally
but MUST NOT change these, or the pipeline breaks.

## Pipeline
frame(binary) -> ingest(C) -> SQLite reading table -> analytics(Python) writes
deck -> model(cropmod, FORTRAN) -> MERIDIAN.OUT -> analytics parses -> forecast
tables -> services(Java API :8081) -> console(jQuery :8080) & ui-next(React).
reporting(Python) reads forecast tables -> fixed-format reports.

## Binary telemetry frame — 44 bytes, BIG-ENDIAN (packet.h)
offset 0  u32 magic  = 0x4D524431 ("MRD1")
offset 4  char stnid[8]  (space-padded, NOT nul-terminated)
offset 12 u16 year
offset 14 u16 doy
offset 16 i32 value[6]  scaled x100, channels: 0=TMAX 1=TMIN 2=RAIN 3=SRAD 4=RH 5=WIND
offset 40 u16 flags     (0x0001 suspect, 0x0002 manual)
offset 42 u16 crc16     CCITT (poly 0x1021, init 0xFFFF) over bytes 0..41
Stations: GUELPH,KITCHNER,WATERLOO,CAMBRIDG,MILTON,BRANTFRD (all <=8 chars).

## SQLite store schema
reading(stnid TEXT, year INT, doy INT, tmax REAL, tmin REAL, rain REAL,
        srad REAL, rh REAL, wind REAL, flags INT, PRIMARY KEY(stnid,year,doy))
    -- created by the C collector (ingest, tsstore.c)
forecast(stnid TEXT, year INT, run_at TEXT, yield_t REAL, ndays INT, model TEXT,
         PRIMARY KEY(stnid,year))
forecast_daily(stnid,year,doy, sw,et,drain,biom,lai, PRIMARY KEY(stnid,year,doy))
    -- created by analytics (store.py)

## Model input deck MERIDIAN.DAT — column-exact (docs/DECKFMT.txt)
REC1  A8,I4,F8.3     stnid, year, latitude
REC2  F8.2,F8.2      awc(frac), rooting depth(mm)
daily I3,F6.1,F6.1,F6.1,F6.2   doy, tmax, tmin, rain, srad
term  " -1"

## Model output MERIDIAN.OUT — column-exact (docs/OUTFMT.txt)
L1 banner: MERIDIAN CROPMOD <ver>  STN=<id>  YEAR=<yyyy>  NDAYS=<n>
L2 header line
daily I4,1X,F7.2,1X,F7.3,1X,F7.3,1X,F7.1,1X,F7.3  doy,sw,et,drain,biom,lai
last: YIELD <F10.3>

## HTTP API (Java, :8081) — routes the front-ends depend on
GET /api/health   -> {"status":"ok","version":"4.2.1"}
GET /api/stations -> list of station ids
GET /api/forecast?stn=<id>&year=<y>  -> forecast summary + daily
GET /api/series?stn=<id>&year=<y>    -> reading series
All responses JSON, header Access-Control-Allow-Origin: *. Console :8080, ui-next both call these.

## Determinism
tools/gen_packets.py is seeded (seed 1000+i per station). The whole pipeline
must be deterministic given a fixed spool.
