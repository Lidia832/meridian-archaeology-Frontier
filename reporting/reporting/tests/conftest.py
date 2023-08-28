"""Shared fixtures: a throwaway forecast store on disk.

We build a real (temp-file) SQLite database with the three contract
tables and a handful of rows, then hand its path to the reports.  A
temp *file* rather than :memory: because the accessor opens the store in
read-only URI mode, which needs a path.

The data is deliberately tiny but exercises the interesting cases:
  * three stations across two years, with distinct yields so ranking has
    something to rank;
  * a station (GUELPH) with forecasts in two different years so the
    latest-run selection has a choice to make;
  * one suspect-flagged reading so the anomaly report is non-empty;
  * a short daily series so the daily-detail table renders.
"""
from __future__ import annotations

import os
import sqlite3
import tempfile

import pytest

from ..config import ReportConfig
from ..db import ReportDB


READING_DDL = """
CREATE TABLE reading (
    stnid TEXT, year INT, doy INT, tmax REAL, tmin REAL, rain REAL,
    srad REAL, rh REAL, wind REAL, flags INT,
    PRIMARY KEY(stnid, year, doy)
)
"""
FORECAST_DDL = """
CREATE TABLE forecast (
    stnid TEXT, year INT, run_at TEXT, yield_t REAL, ndays INT, model TEXT,
    PRIMARY KEY(stnid, year)
)
"""
DAILY_DDL = """
CREATE TABLE forecast_daily (
    stnid TEXT, year INT, doy INT, sw REAL, et REAL, drain REAL,
    biom REAL, lai REAL,
    PRIMARY KEY(stnid, year, doy)
)
"""


def _populate(conn: sqlite3.Connection) -> None:
    conn.executescript(READING_DDL + ";" + FORECAST_DDL + ";" + DAILY_DDL)

    # Forecasts: 2020 and 2021 for three stations.  Uniform ISO run_at so
    # ordinary rendering is well-defined; the deliberately-odd backfill
    # timestamp is exercised in test_latest_run separately.
    forecasts = [
        ("GUELPH", 2020, "2020-08-15T06:00:00", 7.812, 120, "cropmod-4.1"),
        ("KITCHNER", 2020, "2020-08-15T06:00:00", 6.905, 118, "cropmod-4.1"),
        ("WATERLOO", 2020, "2020-08-15T06:00:00", 7.104, 119, "cropmod-4.1"),
        ("GUELPH", 2021, "2021-08-16T06:00:00", 8.221, 122, "cropmod-4.2"),
        ("KITCHNER", 2021, "2021-08-16T06:00:00", 6.550, 121, "cropmod-4.2"),
        ("WATERLOO", 2021, "2021-08-16T06:00:00", 7.430, 120, "cropmod-4.2"),
    ]
    conn.executemany(
        "INSERT INTO forecast VALUES (?,?,?,?,?,?)", forecasts
    )

    # A short daily series for GUELPH 2021.
    daily = []
    for i, doy in enumerate(range(150, 160)):
        daily.append(
            (
                "GUELPH",
                2021,
                doy,
                180.0 + i * 1.5,      # sw
                2.0 + i * 0.10,       # et
                0.5 + i * 0.05,       # drain
                40.0 + i * 12.0,      # biom
                1.0 + i * 0.15,       # lai
            )
        )
    conn.executemany(
        "INSERT INTO forecast_daily VALUES (?,?,?,?,?,?,?,?)", daily
    )

    # Readings: a clean row and a suspect row (flags & 1).
    readings = [
        ("GUELPH", 2021, 150, 24.1, 12.3, 0.0, 22.4, 61.0, 2.1, 0),
        ("GUELPH", 2021, 151, 55.0, 12.9, 0.0, 22.9, 60.0, 2.0, 1),  # suspect
        ("KITCHNER", 2021, 150, 23.8, 11.9, 3.2, 20.1, 66.0, 2.4, 0),
        ("KITCHNER", 2021, 151, 23.9, 12.0, 1.1, 21.0, 65.0, 2.2, 3),  # sus+man
    ]
    conn.executemany(
        "INSERT INTO reading VALUES (?,?,?,?,?,?,?,?,?,?)", readings
    )
    conn.commit()


@pytest.fixture()
def store_path(tmp_path):
    path = os.path.join(str(tmp_path), "meridian_test.sqlite")
    conn = sqlite3.connect(path)
    try:
        _populate(conn)
    finally:
        conn.close()
    return path


@pytest.fixture()
def db(store_path):
    d = ReportDB(store_path)
    try:
        yield d
    finally:
        d.close()


def make_config(store_path, report, **kw) -> ReportConfig:
    cfg = ReportConfig(report=report, db_path=store_path, **kw)
    cfg.validate()
    return cfg
