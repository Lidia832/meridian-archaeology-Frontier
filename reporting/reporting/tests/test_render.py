"""End-to-end render tests: every report renders without error and the
headline numbers land in the output."""
from __future__ import annotations

import pytest

from ..cli import run_report
from ..config import FMT_CSV, WIDTH_NARROW, WIDTH_WIDE
from .conftest import make_config


def test_season_summary_renders(store_path):
    cfg = make_config(store_path, "season", year=2021)
    out = run_report(cfg)
    assert "SEASON SUMMARY -- 2021" in out
    assert "PROVINCIAL AGRI-ENVIRONMENTAL MONITORING" in out
    # GUELPH leads 2021 at 8.221; it should be ranked first.
    assert "8.221" in out
    # provincial mean of 8.221, 6.550, 7.430 == 7.400333...
    assert "PROVINCIAL MEAN" in out
    assert "7.400" in out


def test_season_summary_ranks_descending(store_path):
    cfg = make_config(store_path, "season", year=2021)
    out = run_report(cfg)
    # GUELPH (8.221) must appear before KITCHNER (6.550) in the ranked body
    assert out.index("GUELPH") < out.index("KITCHNER")


def test_station_report_renders(store_path):
    cfg = make_config(store_path, "station", station="GUELPH", width=WIDTH_WIDE)
    out = run_report(cfg)
    assert "STATION REPORT -- GUELPH" in out
    assert "CURRENT STANDING" in out
    # both years present
    assert "2020" in out and "2021" in out
    # year-over-year delta 8.221-7.812 = +0.409
    assert "+0.409" in out


def test_daily_detail_renders_fixed_width(store_path):
    cfg = make_config(
        store_path, "daily", station="GUELPH", year=2021, width=WIDTH_WIDE
    )
    out = run_report(cfg)
    assert "DAILY DETAIL -- GUELPH 2021" in out
    assert "SoilWat" in out and "LAI" in out
    # DOY 150..159 all present
    for doy in range(150, 160):
        assert str(doy) in out


def test_anomaly_report_counts(store_path):
    cfg = make_config(store_path, "anomaly", year=2021)
    out = run_report(cfg)
    assert "DATA-QUALITY" in out
    # two suspect readings across GUELPH+KITCHNER in the fixture
    assert "Suspect readings ..... 2" in out
    assert "SUS" in out  # flag label in the detail table


def test_coverage_report_grid(store_path):
    cfg = make_config(store_path, "coverage")
    out = run_report(cfg)
    assert "COVERAGE REPORT" in out
    assert "STATION x YEAR COVERAGE" in out
    # three stations have both years; MILTON/BRANTFRD/CAMBRIDG have none
    assert "X" in out and "." in out


def test_csv_format_has_no_banner(store_path):
    cfg = make_config(store_path, "season", year=2021, fmt=FMT_CSV)
    out = run_report(cfg)
    assert "PROVINCIAL AGRI-ENVIRONMENTAL MONITORING" not in out
    # header row from the ColumnSet
    assert "YIELD" in out
    assert "8.221" in out


def test_narrow_and_wide_both_render(store_path):
    for w in (WIDTH_NARROW, WIDTH_WIDE):
        cfg = make_config(store_path, "season", year=2021, width=w)
        out = run_report(cfg)
        # every body/banner line fits the page width (form feeds excepted)
        for line in out.splitlines():
            if line == "\f":
                continue
            assert len(line) <= w, "line over %d cols: %r" % (w, line)
