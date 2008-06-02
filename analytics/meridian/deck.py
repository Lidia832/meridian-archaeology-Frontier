"""Writes the fixed-width input deck the cropmod binary expects.

    -- Nightshift (orchestration) side --

The format is defined by the FORMAT statements in model/cropmod.f and is
documented in docs/DECKFMT.txt.  It is column-exact.  If you change a
width here you must change it there, and the model has to be
re-validated afterwards, which is why nobody does.

    header 1 : A8   I4   F8.3        stnid, year, latitude
    header 2 : F8.2 F8.2             awc, rooting depth
    daily    : I3   F6.1 F6.1 F6.1 F6.2   doy, tmax, tmin, rain, srad
    trailer  : ' -1'

M. Chen, 2008-2011 (original).  Column-width guards and the DeckBuilder
added 2022 (newer maintainer) after a shifted latitude field produced a
season of quietly wrong runs -- see the width checks below.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence, Tuple

from .errors import DeckError
from .results import InputReading, ModelInputSpec

DECK_NAME = "MERIDIAN.DAT"

# Soil parameters by station.  These live here rather than in the store
# because the 2008 schema has nowhere to put them.  MRD-91 is open to
# move them into a proper table; until it is, this hard-coded dict IS the
# soil registry and must not be "improved" into a lookup against a table
# that does not exist.
SOIL = {
    # Station ids are the A8 fixed-width field in the deck, so <= 8 chars.
    # Each entry is (awc fraction, rooting depth mm).
    "GUELPH":   (0.150, 1100.0),
    "KITCHNER": (0.142, 1050.0),
    "WATERLOO": (0.138, 1000.0),
    "CAMBRIDG": (0.155, 1200.0),
    "MILTON":   (0.148, 950.0),
    "BRANTFRD": (0.162, 900.0),
}
DEFAULT_SOIL = (0.145, 1000.0)

LATITUDE = {
    "GUELPH":   43.545,
    "KITCHNER": 43.451,
    "WATERLOO": 43.466,
    "CAMBRIDG": 43.360,
    "MILTON":   43.509,
    "BRANTFRD": 43.139,
}
DEFAULT_LAT = 43.545


# --------------------------------------------------------------------------
# Column geometry.  These mirror FORMAT 900/901/902 in cropmod.f exactly.
# The writer below asserts each rendered field lands in its span so a
# too-wide value is caught here rather than shifting every later column.
# --------------------------------------------------------------------------
HDR1_WIDTHS = (8, 4, 8)          # A8, I4, F8.3
HDR2_WIDTHS = (8, 8)             # F8.2, F8.2
DAILY_WIDTHS = (3, 6, 6, 6, 6)   # I3, F6.1, F6.1, F6.1, F6.2
DAILY_RECORD_WIDTH = sum(DAILY_WIDTHS)   # 27


def soil_for(stnid: str) -> Tuple[float, float]:
    """(awc, rooting depth mm) for a station, hard-coded (MRD-91)."""
    return SOIL.get(stnid.upper(), DEFAULT_SOIL)


def latitude_for(stnid: str) -> float:
    return LATITUDE.get(stnid.upper(), DEFAULT_LAT)


def known_stations() -> List[str]:
    """Stations with hard-coded soil AND latitude, in deck order."""
    return [s for s in SOIL if s in LATITUDE]


def spec_from_readings(stnid: str, year: int,
                       readings: Sequence) -> ModelInputSpec:
    """Assemble the Nightshift input spec from raw store readings.

    ``readings`` are duck-typed: any object with doy/tmax/tmin/rain/srad
    works, which keeps this decoupled from store.Reading.
    """
    awc, rdepth = soil_for(stnid)
    lat = latitude_for(stnid)
    projected = [
        InputReading(stnid=stnid, year=year, doy=r.doy, tmax=r.tmax,
                     tmin=r.tmin, rain=r.rain, srad=r.srad)
        for r in readings
    ]
    return ModelInputSpec(stnid=stnid, year=year, latitude=lat, awc=awc,
                          rooting_depth_mm=rdepth, readings=projected)


def _fit(text: str, width: int, stnid: str, year: int, what: str) -> str:
    """Guard that a rendered field occupies exactly its column width.

    Fortran's list-directed read does not forgive a shifted column, so a
    value that overruns its width would silently corrupt every field
    after it.  We refuse to write such a deck.
    """
    if len(text) != width:
        raise DeckError(
            "field %s rendered %d chars, needs exactly %d: %r"
            % (what, len(text), width, text),
            stnid=stnid, year=year)
    return text


@dataclass(frozen=True)
class RenderedDeck:
    """A deck rendered to text, before it touches disk (testable)."""
    text: str
    ndays: int


class DeckBuilder:
    """Renders a ModelInputSpec to the column-exact MERIDIAN.DAT text.

    Split out from ``write_deck`` so the rendering can be unit-tested
    without a filesystem, and so the column guards run on every field.
    """

    def __init__(self, spec: ModelInputSpec):
        self.spec = spec

    def header1(self) -> str:
        s = self.spec
        stn = _fit("%-8s" % s.stnid[:8], HDR1_WIDTHS[0], s.stnid, s.year, "stnid")
        yr = _fit("%4d" % s.year, HDR1_WIDTHS[1], s.stnid, s.year, "year")
        lat = _fit("%8.3f" % s.latitude, HDR1_WIDTHS[2], s.stnid, s.year, "lat")
        return stn + yr + lat

    def header2(self) -> str:
        s = self.spec
        awc = _fit("%8.2f" % s.awc, HDR2_WIDTHS[0], s.stnid, s.year, "awc")
        rd = _fit("%8.2f" % s.rooting_depth_mm, HDR2_WIDTHS[1],
                  s.stnid, s.year, "rdepth")
        return awc + rd

    def daily(self, r: InputReading) -> str:
        s = self.spec
        doy = _fit("%3d" % r.doy, DAILY_WIDTHS[0], s.stnid, s.year, "doy")
        tmax = _fit("%6.1f" % r.tmax, DAILY_WIDTHS[1], s.stnid, s.year, "tmax")
        tmin = _fit("%6.1f" % r.tmin, DAILY_WIDTHS[2], s.stnid, s.year, "tmin")
        rain = _fit("%6.1f" % r.rain, DAILY_WIDTHS[3], s.stnid, s.year, "rain")
        srad = _fit("%6.2f" % r.srad, DAILY_WIDTHS[4], s.stnid, s.year, "srad")
        return doy + tmax + tmin + rain + srad

    def render(self) -> RenderedDeck:
        if self.spec.ndays == 0:
            raise DeckError("cannot write a deck with no daily records",
                            stnid=self.spec.stnid, year=self.spec.year)
        lines = [self.header1(), self.header2()]
        n = 0
        for r in self.spec.readings:
            lines.append(self.daily(r))
            n += 1
        lines.append(" -1")
        return RenderedDeck(text="\n".join(lines) + "\n", ndays=n)


def render_deck(spec: ModelInputSpec) -> RenderedDeck:
    return DeckBuilder(spec).render()


def write_deck_spec(path: str, spec: ModelInputSpec) -> int:
    """Write a fully-formed ModelInputSpec to ``path``.  Returns day count."""
    rendered = render_deck(spec)
    with open(path, "w") as fh:
        fh.write(rendered.text)
    return rendered.ndays


def write_deck(path: str, stnid: str, year: int, readings: Sequence) -> int:
    """Backwards-compatible entry point (M. Chen's original signature).

    Assembles the spec (hard-coded soil/latitude, MRD-91) and renders it
    through the guarded DeckBuilder.  Kept so orchestrator.py and any
    external caller that predates the spec objects keep working.
    """
    spec = spec_from_readings(stnid, year, readings)
    return write_deck_spec(path, spec)
