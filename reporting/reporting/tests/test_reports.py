"""Unit-level tests for the db accessor and format helpers."""
from __future__ import annotations

import pytest

from ..config import WIDTH_NARROW
from ..constants import flag_labels, long_name
from ..format import Column, ColumnSet
from ..format import numfmt


# --- db accessor ----------------------------------------------------------
def test_forecasts_for_year(db):
    fs = db.forecasts_for_year(2021)
    assert [f.stnid for f in fs] == ["GUELPH", "KITCHNER", "WATERLOO"]
    assert pytest.approx(fs[0].yield_t, abs=1e-6) == 8.221


def test_latest_forecast_uniform_timestamps(db):
    # With consistent ISO run_at, the 2021 run (2021-08-16...) is newer
    # than the 2020 run (2020-08-15...), so the latest forecast for
    # GUELPH is the 2021 one.
    latest = db.latest_forecast_for_station("GUELPH")
    assert latest is not None
    assert latest.year == 2021
    assert latest.model == "cropmod-4.2"


def test_suspect_counts(db):
    counts = dict((c[0], (c[1], c[2])) for c in db.suspect_counts(year=2021))
    assert counts["GUELPH"][0] == 1  # one suspect
    assert counts["GUELPH"][1] == 2  # of two readings
    assert counts["KITCHNER"][0] == 1


def test_daily_span(db):
    span = db.daily_span("GUELPH", 2021)
    assert span == (150, 159, 10)


# --- numfmt ---------------------------------------------------------------
def test_fixed_right_justifies():
    assert numfmt.fixed(7.812, 10, 3) == "     7.812"


def test_fixed_overflow_to_asterisks():
    # a value too wide for its field becomes asterisks, never truncated
    assert numfmt.fixed(12345.678, 5, 3) == "*****"


def test_missing_value_marker():
    assert numfmt.fixed(None, 6, 2) == "     ."


def test_signed_delta():
    assert numfmt.signed_delta(0.409, 8, 3) == "  +0.409"
    assert numfmt.signed_delta(-0.409, 8, 3) == "  -0.409"
    assert numfmt.signed_delta(0.0, 8, 3).strip() == "0.000"


def test_text_truncation_marks_with_gt():
    assert numfmt.text("Kitchener-Waterloo", 8) == "Kitchen>"


# --- columns --------------------------------------------------------------
def test_columnset_width_and_row():
    cs = ColumnSet(
        [
            Column("a", "A", 4, kind="int"),
            Column("b", "B", 6, kind="float", decimals=2),
        ]
    )
    # 4 + 1 gutter + 6 == 11
    assert cs.width == 11
    line = cs.row_line({"a": 3, "b": 1.5})
    assert line == "   3   1.50"
    assert len(line) == cs.width


# --- constants ------------------------------------------------------------
def test_flag_labels():
    assert flag_labels(0) == "-"
    assert flag_labels(1) == "SUS"
    assert flag_labels(3) == "SUS+MAN"


def test_long_name_fallback():
    assert long_name("GUELPH") == "Guelph"
    assert long_name("NOWHERE") == "NOWHERE"
