"""Reading and forecast storage.

    -- Archive (output) side --

Thin wrapper over the SQLite store the collector writes into.  We do not
own the schema for ``reading``; the C collector (ingest, tsstore.c)
creates it.  We DO own ``forecast`` and ``forecast_daily`` -- but their
columns are fixed by CONTRACTS.md and must not change, because the Java
API and the reporting subsystem read them by name.

M. Chen wrote the original save path; the query/read-back methods and
the typed save_result were added 2022 (newer maintainer) so aggregate.py
and exportbridge.py can read forecasts back out without every caller
hand-rolling SQL.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence

from .errors import StoreError
from .results import DailyRow, ForecastResult

FORECAST_DDL = """
CREATE TABLE IF NOT EXISTS forecast (
    stnid   TEXT NOT NULL,
    year    INTEGER NOT NULL,
    run_at  TEXT NOT NULL,
    yield_t REAL NOT NULL,
    ndays   INTEGER NOT NULL,
    model   TEXT NOT NULL,
    PRIMARY KEY (stnid, year)
)
"""

SERIES_DDL = """
CREATE TABLE IF NOT EXISTS forecast_daily (
    stnid TEXT NOT NULL,
    year  INTEGER NOT NULL,
    doy   INTEGER NOT NULL,
    sw    REAL, et REAL, drain REAL, biom REAL, lai REAL,
    PRIMARY KEY (stnid, year, doy)
)
"""


@dataclass(frozen=True)
class Reading:
    stnid: str
    year: int
    doy: int
    tmax: float
    tmin: float
    rain: float
    srad: float


@dataclass(frozen=True)
class ForecastRow:
    """A stored forecast summary row, read back out of the DB."""
    stnid: str
    year: int
    run_at: str
    yield_t: float
    ndays: int
    model: str


class Store:
    def __init__(self, path: str):
        self.path = path
        try:
            self.conn = sqlite3.connect(path)
        except sqlite3.Error as exc:
            raise StoreError("cannot open store %s: %s" % (path, exc))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute(FORECAST_DDL)
        self.conn.execute(SERIES_DDL)
        self.conn.commit()

    # -- reading side (collector-owned schema) -----------------------------
    def stations(self) -> List[str]:
        cur = self.conn.execute(
            "SELECT DISTINCT stnid FROM reading ORDER BY stnid")
        return [r["stnid"] for r in cur]

    def years(self, stnid: str) -> List[int]:
        cur = self.conn.execute(
            "SELECT DISTINCT year FROM reading WHERE stnid = ? ORDER BY year",
            (stnid,))
        return [r["year"] for r in cur]

    def station_years(self) -> List[tuple]:
        """All (stnid, year) pairs present in the reading table, ordered."""
        cur = self.conn.execute(
            "SELECT DISTINCT stnid, year FROM reading ORDER BY stnid, year")
        return [(r["stnid"], r["year"]) for r in cur]

    def readings(self, stnid: str, year: int) -> List[Reading]:
        cur = self.conn.execute(
            "SELECT stnid, year, doy, tmax, tmin, rain, srad "
            "FROM reading WHERE stnid = ? AND year = ? ORDER BY doy",
            (stnid, year))
        return [
            Reading(r["stnid"], r["year"], r["doy"],
                    r["tmax"], r["tmin"], r["rain"], r["srad"])
            for r in cur
        ]

    def has_readings(self, stnid: str, year: int) -> bool:
        cur = self.conn.execute(
            "SELECT 1 FROM reading WHERE stnid = ? AND year = ? LIMIT 1",
            (stnid, year))
        return cur.fetchone() is not None

    # -- forecast side (analytics-owned, schema fixed by CONTRACTS) --------
    def save_forecast(self, stnid, year, run_at, yield_t, ndays, model, daily):
        """Original save path (M. Chen).  Kept as the low-level writer.

        ``daily`` is any iterable of objects with doy/sw/et/drain/biom/lai.
        Writes the summary row and the daily rows in one transaction.
        """
        try:
            with self.conn:  # transactional
                self.conn.execute(
                    "INSERT OR REPLACE INTO forecast"
                    " (stnid, year, run_at, yield_t, ndays, model)"
                    " VALUES (?, ?, ?, ?, ?, ?)",
                    (stnid, year, run_at, yield_t, ndays, model))
                self.conn.executemany(
                    "INSERT OR REPLACE INTO forecast_daily"
                    " (stnid, year, doy, sw, et, drain, biom, lai)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [(stnid, year, d.doy, d.sw, d.et, d.drain, d.biom, d.lai)
                     for d in daily])
        except sqlite3.Error as exc:
            raise StoreError("failed to persist forecast: %s" % exc,
                             stnid=stnid, year=year)

    def save_result(self, result: ForecastResult, run_at: str) -> None:
        """Typed save path used by Archive.

        Persists a ForecastResult produced by parse.py.  Delegates to
        save_forecast so there is one SQL writer; the columns written are
        exactly the CONTRACTS schema and nothing more.
        """
        self.save_forecast(
            stnid=result.stnid,
            year=result.year,
            run_at=run_at,
            yield_t=result.yield_t,
            ndays=result.ndays,
            model=result.model,
            daily=result.rows)

    def get_forecast(self, stnid: str, year: int) -> Optional[ForecastRow]:
        cur = self.conn.execute(
            "SELECT stnid, year, run_at, yield_t, ndays, model "
            "FROM forecast WHERE stnid = ? AND year = ?",
            (stnid, year))
        r = cur.fetchone()
        if r is None:
            return None
        return ForecastRow(r["stnid"], r["year"], r["run_at"], r["yield_t"],
                           r["ndays"], r["model"])

    def has_forecast(self, stnid: str, year: int) -> bool:
        return self.get_forecast(stnid, year) is not None

    def list_forecasts(self) -> List[ForecastRow]:
        cur = self.conn.execute(
            "SELECT stnid, year, run_at, yield_t, ndays, model "
            "FROM forecast ORDER BY stnid, year")
        return [ForecastRow(r["stnid"], r["year"], r["run_at"], r["yield_t"],
                            r["ndays"], r["model"]) for r in cur]

    def daily_rows(self, stnid: str, year: int) -> List[DailyRow]:
        """Read stored daily forecast rows back as DailyRow DTOs.

        Used by aggregate.py to summarise a forecast that was persisted
        earlier, and by exportbridge.py to package the daily series.
        """
        cur = self.conn.execute(
            "SELECT doy, sw, et, drain, biom, lai FROM forecast_daily "
            "WHERE stnid = ? AND year = ? ORDER BY doy",
            (stnid, year))
        return [
            DailyRow(doy=r["doy"], sw=r["sw"], et=r["et"], drain=r["drain"],
                     biom=r["biom"], lai=r["lai"])
            for r in cur
        ]

    def delete_forecast(self, stnid: str, year: int) -> None:
        try:
            with self.conn:
                self.conn.execute(
                    "DELETE FROM forecast WHERE stnid = ? AND year = ?",
                    (stnid, year))
                self.conn.execute(
                    "DELETE FROM forecast_daily WHERE stnid = ? AND year = ?",
                    (stnid, year))
        except sqlite3.Error as exc:
            raise StoreError("failed to delete forecast: %s" % exc,
                             stnid=stnid, year=year)

    def close(self):
        self.conn.close()
