"""Station Report.

One station, every year on file: the yield trend, the number of forecast
days, and which model version produced each year's number.  Where the
season summary is a snapshot across space, this is the time series for a
single site -- the page an agronomist pulls when a grower asks "is our
station's forecast drifting?".

The header block calls out the station's *current* standing: its latest
forecast run, the model version in force as of that run, and the newest
yield.  "Latest run" is the forecast row with the newest run_at across
all the station's years (see db.latest_forecast_for_station).

    R. Halloran, 2017.  Trend delta column added 2019; current-standing
    header block added 2021 (P. Adeyemi).
"""
from __future__ import annotations

from typing import List, Optional

from ..constants import long_name, region_of
from ..db import Forecast
from ..format import Block, Column, ColumnSet
from .base import BaseReport, ReportError


class StationReport(BaseReport):
    name = "station"
    title = "STATION REPORT"
    code = "STNR"

    def subtitle(self) -> str:
        stn = self._require_station()
        return "%s -- %s (%s)" % (self.title, stn, long_name(stn))

    def ref_code(self):
        return self._default_ref(self._require_station())

    def running_title(self) -> str:
        return "STATION REPORT -- %s" % self._require_station()

    def _columns(self) -> ColumnSet:
        if self.config.is_wide():
            return ColumnSet(
                [
                    Column("year", "YEAR", 6, kind="int"),
                    Column("yield_t", "YIELD", 10, kind="float", decimals=3,
                           unit="t/ha"),
                    Column("delta", "YoY", 8, kind="delta", decimals=3,
                           unit="t/ha"),
                    Column("ndays", "DAYS", 6, kind="int"),
                    Column("model", "MODEL", 16, kind="text", align="left"),
                    Column("run_at", "RUN AT", 20, kind="text", align="left"),
                ]
            )
        return ColumnSet(
            [
                Column("year", "YEAR", 6, kind="int"),
                Column("yield_t", "YIELD", 11, kind="float", decimals=3,
                       unit="t/ha"),
                Column("delta", "YoY", 9, kind="delta", decimals=3,
                       unit="t/ha"),
                Column("ndays", "DAYS", 7, kind="int"),
                Column("model", "MODEL", 15, kind="text", align="left"),
            ]
        )

    def build_blocks(self) -> List[Block]:
        stn = self._require_station()
        forecasts = self.db.forecasts_for_station(stn)
        if not forecasts:
            raise ReportError("no forecasts on file for station %s" % stn)

        head = self._standing_block(stn, forecasts)

        rows = []
        prev: Optional[float] = None
        for f in forecasts:  # already ordered oldest year first
            delta = None if prev is None else (f.yield_t - prev)
            rows.append(
                {
                    "year": f.year,
                    "yield_t": f.yield_t,
                    "delta": delta,
                    "ndays": f.ndays,
                    "model": f.model,
                    "run_at": f.run_at,
                }
            )
            prev = f.yield_t

        table = Block(
            heading="YIELD BY YEAR",
            columns=self._columns(),
            rows=rows,
        )

        trend = self._trend_block(forecasts)
        return [head, table, trend]

    def _standing_block(self, stn: str, forecasts: List[Forecast]) -> Block:
        """Current-standing header: latest run, model in force, newest
        yield.  Uses the run-selection helper, not just the last year in
        the table, because a late backfill of an *older* year can be the
        newest run on record."""
        latest = self.db.latest_forecast_for_station(stn)
        lines = [
            "  Station .............. %-10s  %s" % (stn, long_name(stn)),
            "  Region ............... %s" % region_of(stn),
            "  Years on file ........ %d  (%d..%d)"
            % (
                len(forecasts),
                min(f.year for f in forecasts),
                max(f.year for f in forecasts),
            ),
        ]
        if latest is not None:
            lines += [
                "  Latest forecast run .. %s" % latest.run_at,
                "  Model in force ....... %s" % latest.model,
                "  Latest yield ......... %.3f t/ha  (crop year %d)"
                % (latest.yield_t, latest.year),
            ]
        return Block(heading="CURRENT STANDING", text_lines=lines)

    def _trend_block(self, forecasts: List[Forecast]) -> Block:
        ys = [f.yield_t for f in forecasts]
        mean = sum(ys) / len(ys)
        lo = min(forecasts, key=lambda f: f.yield_t)
        hi = max(forecasts, key=lambda f: f.yield_t)
        first, last = forecasts[0], forecasts[-1]
        net = last.yield_t - first.yield_t
        lines = [
            "  Mean yield ........... %.3f t/ha over %d year(s)"
            % (mean, len(ys)),
            "  Best year ............ %d  (%.3f t/ha)" % (hi.year, hi.yield_t),
            "  Worst year ........... %d  (%.3f t/ha)" % (lo.year, lo.yield_t),
            "  Net change ........... %+.3f t/ha  (%d -> %d)"
            % (net, first.year, last.year),
        ]
        return Block(heading="TREND", text_lines=lines)
