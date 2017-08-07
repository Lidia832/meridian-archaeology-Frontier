"""Read-only accessor over the Meridian SQLite store.

Reporting is one of the newer subsystems, so unlike the C collector we
are allowed to talk to sqlite3 straight from Python -- there is no need
to go through the collector's storage library.  We DO respect that the
schema is not ours: reporting never creates, alters or writes any table.
Everything here is SELECT.

The connection is opened in read-only mode (URI `mode=ro`) so a report
run can never accidentally take a write lock on the store while the
nightly forecast job is trying to update it.  If the file is missing we
raise a clear error rather than let sqlite create an empty database,
which is its unhelpful default.

    R. Halloran, 2017.  ro-mode + typed row helpers added 2019.
    Query helpers for coverage/anomaly folded in 2023 (P. Adeyemi).
"""
from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence


class ReportDBError(Exception):
    """Raised for any problem opening or querying the store."""


# --- Row record types -----------------------------------------------------
# Small frozen dataclasses so the report modules get attribute access
# (row.yield_t) instead of positional tuples, which were a constant
# source of off-by-one bugs back in the tuple days.

@dataclass(frozen=True)
class Reading:
    stnid: str
    year: int
    doy: int
    tmax: Optional[float]
    tmin: Optional[float]
    rain: Optional[float]
    srad: Optional[float]
    rh: Optional[float]
    wind: Optional[float]
    flags: int


@dataclass(frozen=True)
class Forecast:
    stnid: str
    year: int
    run_at: str
    yield_t: float
    ndays: int
    model: str


@dataclass(frozen=True)
class DailyRow:
    stnid: str
    year: int
    doy: int
    sw: Optional[float]
    et: Optional[float]
    drain: Optional[float]
    biom: Optional[float]
    lai: Optional[float]


class ReportDB:
    """Thin read-only wrapper around a sqlite3 connection.

    Usage:
        with ReportDB(path) as db:
            for f in db.forecasts_for_year(2021):
                ...

    The object is a context manager; it can also be used without `with`
    as long as the caller remembers to call close().
    """

    def __init__(self, path: str):
        self.path = path
        self._conn: Optional[sqlite3.Connection] = None
        self._open()

    # -- lifecycle ---------------------------------------------------------
    def _open(self) -> None:
        if not os.path.exists(self.path):
            raise ReportDBError("store not found: %s" % self.path)
        # Read-only URI open.  isolation_level=None: we never write, so we
        # do not want an implicit transaction held open across selects.
        uri = "file:%s?mode=ro" % _uri_escape(os.path.abspath(self.path))
        try:
            self._conn = sqlite3.connect(uri, uri=True, timeout=5.0)
        except sqlite3.OperationalError as exc:  # pragma: no cover - env dep
            raise ReportDBError("cannot open store %s: %s" % (self.path, exc))
        self._conn.row_factory = sqlite3.Row

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def __enter__(self) -> "ReportDB":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            raise ReportDBError("database is closed")
        return self._conn

    # -- low level ---------------------------------------------------------
    def _rows(self, sql: str, params: Sequence = ()) -> List[sqlite3.Row]:
        try:
            cur = self.conn.execute(sql, tuple(params))
            return cur.fetchall()
        except sqlite3.Error as exc:
            raise ReportDBError("query failed: %s\n  SQL: %s" % (exc, sql))

    def _one(self, sql: str, params: Sequence = ()) -> Optional[sqlite3.Row]:
        rows = self._rows(sql, params)
        return rows[0] if rows else None

    def table_exists(self, name: str) -> bool:
        row = self._one(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            (name,),
        )
        return row is not None

    # -- reference queries -------------------------------------------------
    def all_station_ids(self) -> List[str]:
        """Distinct station ids that appear anywhere in the forecast set.

        We take these from `forecast` rather than the fixed roster in
        constants so that a report reflects what is actually in the
        store -- a station that never produced a forecast should not
        show up as a phantom row.
        """
        rows = self._rows(
            "SELECT DISTINCT stnid FROM forecast ORDER BY stnid"
        )
        return [r["stnid"] for r in rows]

    def all_years(self) -> List[int]:
        rows = self._rows(
            "SELECT DISTINCT year FROM forecast ORDER BY year"
        )
        return [int(r["year"]) for r in rows]

    def years_for_station(self, stnid: str) -> List[int]:
        rows = self._rows(
            "SELECT DISTINCT year FROM forecast WHERE stnid=? ORDER BY year",
            (stnid,),
        )
        return [int(r["year"]) for r in rows]

    # -- forecast queries --------------------------------------------------
    def forecasts_for_year(self, year: int) -> List[Forecast]:
        """Every station's forecast for one year, ordered by station id.

        There is at most one forecast row per (station, year) in the
        store, so no run selection is needed here.
        """
        rows = self._rows(
            "SELECT stnid, year, run_at, yield_t, ndays, model "
            "FROM forecast WHERE year=? ORDER BY stnid",
            (year,),
        )
        return [_forecast(r) for r in rows]

    def forecasts_for_station(self, stnid: str) -> List[Forecast]:
        """All years' forecasts for one station, oldest year first."""
        rows = self._rows(
            "SELECT stnid, year, run_at, yield_t, ndays, model "
            "FROM forecast WHERE stnid=? ORDER BY year",
            (stnid,),
        )
        return [_forecast(r) for r in rows]

    def forecast(self, stnid: str, year: int) -> Optional[Forecast]:
        row = self._one(
            "SELECT stnid, year, run_at, yield_t, ndays, model "
            "FROM forecast WHERE stnid=? AND year=?",
            (stnid, year),
        )
        return _forecast(row) if row else None

    def latest_forecast_for_station(self, stnid: str) -> Optional[Forecast]:
        """The station's most recent forecast run across all its years.

        The station report prints "as of the latest run" figures -- the
        model version in force, the newest yield number -- so we need
        the row with the newest run_at.  run_at is the ISO-ish timestamp
        the analytics job stamps when it writes the forecast.

        We let SQLite pick the newest with MAX(run_at); the store keeps
        run_at as TEXT and the analytics job writes it in a consistent
        format, so the newest string is the newest run.
        # MRD-238: latest-run selection compares run_at as text
        """
        row = self._one(
            "SELECT stnid, year, run_at, yield_t, ndays, model "
            "FROM forecast WHERE stnid=? "
            "AND run_at = (SELECT MAX(run_at) FROM forecast WHERE stnid=?)",
            (stnid, stnid),
        )
        return _forecast(row) if row else None

    def latest_run_at(self) -> Optional[str]:
        """Newest run_at anywhere in the store, for the 'generated from'
        line in banners.  Same text-ordering assumption as above."""
        row = self._one("SELECT MAX(run_at) AS m FROM forecast")
        return row["m"] if row and row["m"] is not None else None

    # -- daily series ------------------------------------------------------
    def daily_series(self, stnid: str, year: int) -> List[DailyRow]:
        rows = self._rows(
            "SELECT stnid, year, doy, sw, et, drain, biom, lai "
            "FROM forecast_daily WHERE stnid=? AND year=? ORDER BY doy",
            (stnid, year),
        )
        return [_daily(r) for r in rows]

    def daily_span(self, stnid: str, year: int) -> Optional[tuple]:
        """(min_doy, max_doy, count) for a station-year, or None if empty."""
        row = self._one(
            "SELECT MIN(doy) AS lo, MAX(doy) AS hi, COUNT(*) AS n "
            "FROM forecast_daily WHERE stnid=? AND year=?",
            (stnid, year),
        )
        if row is None or row["n"] == 0:
            return None
        return (int(row["lo"]), int(row["hi"]), int(row["n"]))

    # -- readings / anomalies ----------------------------------------------
    def suspect_readings(
        self, year: Optional[int] = None, stnid: Optional[str] = None
    ) -> List[Reading]:
        """Readings with the suspect flag (0x1) set.

        Optional year/station filters narrow the anomaly report.  The
        bitwise test is done in SQL so we do not drag every reading in
        the store across just to throw most of them away.
        """
        sql = (
            "SELECT stnid, year, doy, tmax, tmin, rain, srad, rh, wind, flags "
            "FROM reading WHERE (flags & 1) = 1"
        )
        params: List = []
        if year is not None:
            sql += " AND year=?"
            params.append(year)
        if stnid is not None:
            sql += " AND stnid=?"
            params.append(stnid)
        sql += " ORDER BY stnid, year, doy"
        return [_reading(r) for r in self._rows(sql, params)]

    def suspect_counts(self, year: Optional[int] = None) -> List[tuple]:
        """(stnid, suspect_count, total_count) per station.

        Used by the anomaly report's summary block.  A LEFT-ish manual
        join would be cleaner but the store has no index that helps, so
        we do two grouped passes and stitch them in Python.
        """
        base = "SELECT stnid, COUNT(*) AS n FROM reading"
        where = ""
        params: List = []
        if year is not None:
            where = " WHERE year=?"
            params.append(year)
        totals = {
            r["stnid"]: int(r["n"])
            for r in self._rows(base + where + " GROUP BY stnid", params)
        }
        sus_where = " WHERE (flags & 1) = 1"
        sus_params: List = []
        if year is not None:
            sus_where += " AND year=?"
            sus_params.append(year)
        suspects = {
            r["stnid"]: int(r["n"])
            for r in self._rows(
                "SELECT stnid, COUNT(*) AS n FROM reading"
                + sus_where
                + " GROUP BY stnid",
                sus_params,
            )
        }
        out = []
        for stnid in sorted(totals):
            out.append((stnid, suspects.get(stnid, 0), totals[stnid]))
        return out

    def reading_years(self) -> List[int]:
        rows = self._rows("SELECT DISTINCT year FROM reading ORDER BY year")
        return [int(r["year"]) for r in rows]

    # -- coverage ----------------------------------------------------------
    def forecast_presence(self) -> List[tuple]:
        """(stnid, year) pairs that have a forecast, for the coverage grid."""
        rows = self._rows("SELECT stnid, year FROM forecast ORDER BY stnid, year")
        return [(r["stnid"], int(r["year"])) for r in rows]


# --- module helpers -------------------------------------------------------
def _uri_escape(path: str) -> str:
    """Minimal escaping so a path with spaces survives the file: URI."""
    return path.replace("?", "%3f").replace("#", "%23").replace(" ", "%20")


def _forecast(r: sqlite3.Row) -> Forecast:
    return Forecast(
        stnid=r["stnid"],
        year=int(r["year"]),
        run_at=r["run_at"],
        yield_t=float(r["yield_t"]),
        ndays=int(r["ndays"]),
        model=r["model"],
    )


def _daily(r: sqlite3.Row) -> DailyRow:
    return DailyRow(
        stnid=r["stnid"],
        year=int(r["year"]),
        doy=int(r["doy"]),
        sw=_maybe_float(r["sw"]),
        et=_maybe_float(r["et"]),
        drain=_maybe_float(r["drain"]),
        biom=_maybe_float(r["biom"]),
        lai=_maybe_float(r["lai"]),
    )


def _reading(r: sqlite3.Row) -> Reading:
    return Reading(
        stnid=r["stnid"],
        year=int(r["year"]),
        doy=int(r["doy"]),
        tmax=_maybe_float(r["tmax"]),
        tmin=_maybe_float(r["tmin"]),
        rain=_maybe_float(r["rain"]),
        srad=_maybe_float(r["srad"]),
        rh=_maybe_float(r["rh"]),
        wind=_maybe_float(r["wind"]),
        flags=int(r["flags"]),
    )


def _maybe_float(v) -> Optional[float]:
    return None if v is None else float(v)
