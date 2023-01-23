"""Handoff of stored forecasts to the reporting subsystem.

    -- Archive (output) side --

CONTRACTS.md: "reporting(Python) reads forecast tables -> fixed-format
reports."  Reporting could read the SQLite store directly, and today it
does.  But that couples reporting to our table layout, and every time a
column name is discussed someone worries about MRD-231-style "what does
the same answer mean" churn.  This module is the seam on the *outbound*
side: a thin, read-only bundle of exactly what a report needs, built from
the store and the season summaries, in plain dict/dataclass form with no
SQLite handle attached.

It is deliberately one-directional and side-effect free: it never writes,
never runs the model, and hands back value objects the reporting code can
consume without importing anything else from this package.  If the store
schema ever has to change (it must not, per CONTRACTS), this is the one
place reporting would need to be re-pointed.

Added 2023 (newer maintainer) alongside aggregate.py.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional

from .aggregate import summarize_stored
from .errors import ExportError
from .results import DailyRow, SeasonSummary
from .store import Store

EXPORT_FORMAT_VERSION = "1.0"


@dataclass(frozen=True)
class ExportedDaily:
    doy: int
    sw: float
    et: float
    drain: float
    biom: float
    lai: float

    @classmethod
    def from_row(cls, r: DailyRow) -> "ExportedDaily":
        return cls(doy=r.doy, sw=r.sw, et=r.et, drain=r.drain,
                   biom=r.biom, lai=r.lai)


@dataclass(frozen=True)
class ExportedForecast:
    """One forecast, packaged for a report: summary + daily series.

    Everything the reporting subsystem needs for a station-year report,
    with no live database handle and no analytics internals leaking
    through.  ``format_version`` lets reporting detect a shape change.
    """
    format_version: str
    stnid: str
    year: int
    run_at: str
    model: str
    yield_t: float
    ndays: int
    summary: Dict
    daily: List[ExportedDaily] = field(default_factory=list)

    def to_dict(self) -> Dict:
        d = asdict(self)
        return d


class ExportBridge:
    """Builds outbound export bundles from the store.

    Holds a Store but exposes only read/package operations.  Callers on
    the reporting side use ``for_station_year`` for a single report or
    ``manifest`` to discover what is available.
    """

    def __init__(self, store: Store):
        self.store = store

    def manifest(self) -> List[Dict]:
        """List available forecasts as light dicts (no daily series)."""
        out: List[Dict] = []
        for fc in self.store.list_forecasts():
            out.append({
                "stnid": fc.stnid,
                "year": fc.year,
                "run_at": fc.run_at,
                "yield_t": fc.yield_t,
                "ndays": fc.ndays,
                "model": fc.model,
            })
        return out

    def for_station_year(self, stnid: str, year: int) -> ExportedForecast:
        fc = self.store.get_forecast(stnid, year)
        if fc is None:
            raise ExportError("no stored forecast to export",
                              stnid=stnid, year=year)
        rows = self.store.daily_rows(stnid, year)
        if not rows:
            raise ExportError("stored forecast has no daily rows",
                              stnid=stnid, year=year)
        try:
            summary: SeasonSummary = summarize_stored(self.store, stnid, year)
            summary_dict = summary.to_dict()
        except ExportError:
            raise
        except Exception as exc:  # aggregate errors -> export errors
            raise ExportError("could not summarise for export: %s" % exc,
                              stnid=stnid, year=year)
        return ExportedForecast(
            format_version=EXPORT_FORMAT_VERSION,
            stnid=fc.stnid,
            year=fc.year,
            run_at=fc.run_at,
            model=fc.model,
            yield_t=fc.yield_t,
            ndays=fc.ndays,
            summary=summary_dict,
            daily=[ExportedDaily.from_row(r) for r in rows],
        )

    def for_station(self, stnid: str) -> List[ExportedForecast]:
        out: List[ExportedForecast] = []
        for fc in self.store.list_forecasts():
            if fc.stnid == stnid:
                out.append(self.for_station_year(fc.stnid, fc.year))
        return out

    def export_all(self) -> List[ExportedForecast]:
        return [self.for_station_year(fc.stnid, fc.year)
                for fc in self.store.list_forecasts()]


def build_bridge(store: Store) -> ExportBridge:
    return ExportBridge(store)
