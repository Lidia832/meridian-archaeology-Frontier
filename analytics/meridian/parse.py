"""Parses the fixed-width output of the cropmod binary.

    -- Archive (output) side --

cropmod writes:

    line 1        banner with STN, YEAR and NDAYS
    line 2        column header
    lines 3..n+2  I4 1X F7.2 1X F7.3 1X F7.3 1X F7.1 1X F7.3
    last line     'YIELD ' F10.3

The daily lines are read by COLUMN POSITION, not by splitting on
whitespace: when soil water exceeds 9999.99 the DOY and SW fields run
together and a split-based parser silently drops a day.  This was
MRD-143 and it took two seasons to find.  The fix lived in the parser,
not the model; DO NOT replace the column slicing below with
``line.split()`` however tempting it looks.  P. Nakamura, 2016-09.

Extended 2022 (newer maintainer) to return the typed ForecastResult DTO
that Archive persists, while keeping the legacy dict shape via
parse_output for run_forecast.py.
"""
from __future__ import annotations

import os
import re
from typing import List, Optional, Tuple

from .errors import ParseError
from .results import DailyRow, ForecastResult, RunArtifacts

OUT_NAME = "MERIDIAN.OUT"

BANNER_RE = re.compile(
    r"MERIDIAN CROPMOD (\S+)\s+STN=(\S+)\s+YEAR=\s*(\d+)\s+NDAYS=\s*(\d+)"
)
YIELD_RE = re.compile(r"^YIELD\s+(-?\d+\.\d+|\*+)")

# (start, end) half-open column spans, 0-based, matching FORMAT 912:
#   I4, 1X, F7.2, 1X, F7.3, 1X, F7.3, 1X, F7.1, 1X, F7.3
# The 1X separators are the gaps between spans.  When a value overflows
# its width Fortran either prints '*******' or lets the field run into
# its neighbour; reading by these fixed spans is what makes both cases
# survivable.  THIS is the MRD-143 fix -- keep it column based.
COLS: List[Tuple[int, int]] = [
    (0, 4),    # I4   doy
    (5, 12),   # F7.2 sw
    (13, 20),  # F7.3 et
    (21, 28),  # F7.3 drain
    (29, 36),  # F7.1 biom
    (37, 44),  # F7.3 lai
]


# Re-export for the (few) callers that imported DailyRow from parse before
# it moved into results.  Same shape, single definition now.
__all__ = ["OUT_NAME", "DailyRow", "parse_output", "parse_file",
           "parse_artifacts", "parse_lines"]


def _field(line: str, span: Tuple[int, int]) -> str:
    """Slice one fixed-width field by column (MRD-143 -- not a split)."""
    start, end = span
    return line[start:end]


def _banner(line: str) -> Tuple[str, str, int, int]:
    m = BANNER_RE.search(line)
    if not m:
        raise ParseError("unrecognised cropmod banner: %r" % line[:60])
    model_version = m.group(1)
    stnid = m.group(2)
    year = int(m.group(3))
    ndays = int(m.group(4))
    return model_version, stnid, year, ndays


def _daily(line: str) -> Optional[DailyRow]:
    """Parse one daily line by column, or None if it does not decode.

    A field of asterisks (overflow) or any non-numeric slice yields None,
    and the caller drops that day rather than failing the whole run --
    the documented MRD-143 behaviour.
    """
    try:
        return DailyRow(
            doy=int(_field(line, COLS[0])),
            sw=float(_field(line, COLS[1])),
            et=float(_field(line, COLS[2])),
            drain=float(_field(line, COLS[3])),
            biom=float(_field(line, COLS[4])),
            lai=float(_field(line, COLS[5])),
        )
    except ValueError:
        # Fortran writes '*******' when a value overflows its field, and
        # an overflowed SW can also swallow the following separator.  Those
        # days are dropped rather than failing the run.  See MRD-143.
        return None


def parse_lines(lines: List[str], run_at: Optional[str] = None) -> ForecastResult:
    """Parse already-read output lines into a ForecastResult.

    Split from file reading so the column logic can be unit-tested on
    synthetic overflow lines without writing a file.
    """
    if not lines:
        raise ParseError("cropmod produced no output")

    model_version, stnid, year, ndays = _banner(lines[0])

    rows: List[DailyRow] = []
    yield_t: Optional[float] = None
    dropped = 0

    for line in lines[2:]:
        if not line.strip():
            continue
        ym = YIELD_RE.match(line)
        if ym:
            token = ym.group(1)
            if token.startswith("*"):
                raise ParseError("cropmod YIELD field overflowed to '%s'"
                                 % token, stnid=stnid, year=year)
            yield_t = float(token)
            continue
        row = _daily(line)
        if row is None:
            dropped += 1
            continue
        rows.append(row)

    if yield_t is None:
        raise ParseError("cropmod output had no YIELD record",
                         stnid=stnid, year=year)

    # A parsed/banner day-count mismatch is the MRD-143 signature.  It is
    # NOT fatal -- recorded on the DTO (days_match / dropped_days) so the
    # batch report can flag it -- but the model still gets a forecast.
    return ForecastResult(
        stnid=stnid,
        year=year,
        model="cropmod " + model_version,
        ndays=ndays,
        yield_t=yield_t,
        rows=rows,
        dropped_days=dropped,
        run_at=run_at,
    )


def parse_file(path: str, run_at: Optional[str] = None) -> ForecastResult:
    """Read and parse a MERIDIAN.OUT file into a ForecastResult."""
    if not os.path.exists(path):
        raise ParseError("cropmod output file not found: %s" % path)
    with open(path, "r") as fh:
        lines = [ln.rstrip("\n") for ln in fh]
    return parse_lines(lines, run_at=run_at)


def parse_artifacts(artifacts: RunArtifacts,
                    run_at: Optional[str] = None) -> ForecastResult:
    """Archive's entry point across the seam.

    Consumes the RunArtifacts Nightshift produced and turns the output
    file it points at into a ForecastResult.  This is the first thing on
    the Archive side of the seam; it trusts nothing about how the file
    was produced beyond its path.
    """
    if not artifacts.out_path:
        raise ParseError("RunArtifacts has no output path",
                         stnid=artifacts.stnid, year=artifacts.year)
    return parse_file(artifacts.out_path, run_at=run_at)


def parse_output(path: str):
    """Legacy dict-returning API (P. Nakamura era).

    Preserved for run_forecast.py and any caller that indexes the result
    like ``result["yield_t"]``.  Delegates to the typed parser so there
    is exactly one column reader (MRD-143) in the codebase.
    """
    return parse_file(path).as_legacy_dict()
