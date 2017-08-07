"""Daily Detail report.

The forecast_daily series for one station and year, printed as a fixed-
width table: day of year, soil water, evapotranspiration, drainage,
above-ground biomass and leaf area index -- the same six quantities the
crop model emits (docs/OUTFMT.txt), one row per simulated day.

This is the report that forced the 132-column layout.  At 80 columns the
six numeric fields plus a day column are cramped and the biomass values
in a good year overflow; at 132 they breathe and we can widen the fields
enough that biomass no longer trips the asterisk guard.  Both widths are
still supported because a lot of the ministry's terminals never got wider
than 80.

The overflow handling is deliberate and matches the model: a value that
will not fit its field prints as asterisks rather than a wrong number
(numfmt.overflow), so a reader is never handed a silently truncated
figure.  See MRD-143 in the model output notes for why.

    R. Halvorsen wrote the original against MERIDIAN.OUT in 1996; ported
    to read forecast_daily from the store by R. Halloran, 2017; widened
    to 132 by P. Adeyemi, 2021.
"""
from __future__ import annotations

from typing import List

from ..constants import long_name
from ..format import Block, Column, ColumnSet
from .base import BaseReport, ReportError


class DailyDetailReport(BaseReport):
    name = "daily"
    title = "DAILY DETAIL"
    code = "DALY"

    def subtitle(self) -> str:
        stn = self._require_station()
        year = self._require_year()
        return "%s -- %s %d" % (self.title, stn, year)

    def ref_code(self):
        return self._default_ref("%s-%d" % (self._require_station(), self._require_year()))

    def running_title(self) -> str:
        return "DAILY DETAIL -- %s %d" % (
            self._require_station(),
            self._require_year(),
        )

    def _columns(self) -> ColumnSet:
        if self.config.is_wide():
            # Wide fan-fold: generous fields, biomass gets 9 so a heavy
            # crop year does not overflow.
            return ColumnSet(
                [
                    Column("doy", "DOY", 4, kind="int"),
                    Column("sw", "SoilWat", 9, kind="float", decimals=2,
                           unit="mm"),
                    Column("et", "ET", 9, kind="float", decimals=3, unit="mm"),
                    Column("drain", "Drain", 9, kind="float", decimals=3,
                           unit="mm"),
                    Column("biom", "Biomass", 10, kind="float", decimals=2,
                           unit="g/m2"),
                    Column("lai", "LAI", 8, kind="float", decimals=3,
                           unit="m2/m2"),
                ]
            )
        # Narrow: tight fields; matches the historical MERIDIAN.OUT widths
        # (F7.x) closely so a printout lines up with an archived model run.
        return ColumnSet(
            [
                Column("doy", "DOY", 4, kind="int"),
                Column("sw", "SoilWat", 8, kind="float", decimals=2,
                       unit="mm"),
                Column("et", "ET", 8, kind="float", decimals=3, unit="mm"),
                Column("drain", "Drain", 8, kind="float", decimals=3,
                       unit="mm"),
                Column("biom", "Biomass", 8, kind="float", decimals=1,
                       unit="g/m2"),
                Column("lai", "LAI", 7, kind="float", decimals=3,
                       unit="m2/m2"),
            ]
        )

    def build_blocks(self) -> List[Block]:
        stn = self._require_station()
        year = self._require_year()
        series = self.db.daily_series(stn, year)
        if not series:
            raise ReportError(
                "no daily forecast series for %s %d" % (stn, year)
            )

        rows = [
            {
                "doy": d.doy,
                "sw": d.sw,
                "et": d.et,
                "drain": d.drain,
                "biom": d.biom,
                "lai": d.lai,
            }
            for d in series
        ]

        header = self._context_block(stn, year, series)
        table = Block(
            heading="DAILY FORECAST SERIES",
            columns=self._columns(),
            rows=rows,
        )
        foot = self._summary_block(series)
        return [header, table, foot]

    def _context_block(self, stn, year, series) -> Block:
        span = self.db.daily_span(stn, year)
        fc = self.db.forecast(stn, year)
        lines = [
            "  Station .............. %-10s %s" % (stn, long_name(stn)),
            "  Crop year ............ %d" % year,
        ]
        if span:
            lo, hi, cnt = span
            lines.append(
                "  Day range ............ DOY %d..%d  (%d days)" % (lo, hi, cnt)
            )
        if fc is not None:
            lines.append(
                "  Season yield ......... %.3f t/ha  (run %s)"
                % (fc.yield_t, fc.run_at)
            )
        return Block(heading="SERIES CONTEXT", text_lines=lines)

    def _summary_block(self, series) -> Block:
        """End-of-series roll-ups: season ET and drainage totals, peak LAI
        and peak biomass with the day they occur -- the quick agronomic
        read a full daily table is too dense to give at a glance."""
        def _sum(attr):
            return sum(getattr(d, attr) or 0.0 for d in series)

        def _peak(attr):
            best = None
            for d in series:
                v = getattr(d, attr)
                if v is None:
                    continue
                if best is None or v > best[1]:
                    best = (d.doy, v)
            return best

        et_total = _sum("et")
        drain_total = _sum("drain")
        peak_lai = _peak("lai")
        peak_biom = _peak("biom")
        lines = [
            "  Season ET total ...... %.2f mm" % et_total,
            "  Season drainage ...... %.2f mm" % drain_total,
        ]
        if peak_lai:
            lines.append(
                "  Peak LAI ............. %.3f  on DOY %d"
                % (peak_lai[1], peak_lai[0])
            )
        if peak_biom:
            lines.append(
                "  Peak biomass ......... %.1f g/m2  on DOY %d"
                % (peak_biom[1], peak_biom[0])
            )
        return Block(heading="SEASON ROLL-UP", text_lines=lines)
