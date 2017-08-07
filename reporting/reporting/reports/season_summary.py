"""Season Summary report.

The flagship printout: for one crop year, every station's forecast yield,
ranked best to worst, with a provincial total and mean at the foot.  This
is the page the ministry pins to the board in August and the one a deputy
minister actually reads, so its layout is the most fussed-over of the lot.

Layout notes:
  * stations are ranked by yield descending; ties keep station order.
  * a rank column (1) 2) ...) numbers the ranked rows.
  * the foot block carries the provincial TOTAL yield (sum) and MEAN
    (arithmetic mean over stations that produced a forecast), plus a
    count of stations reporting vs the full roster so a missing station
    is visible.
  * the 132-column variant adds the model version and run date columns
    that do not fit at 80.

    R. Halloran, 2018 -- season summary rewrite (this file).
    Widened to 132 col 2021 by P. Adeyemi.
"""
from __future__ import annotations

from typing import List

from ..constants import long_name, region_of
from ..format import Block, Column, ColumnSet
from .base import BaseReport, ReportError


class SeasonSummaryReport(BaseReport):
    name = "season"
    title = "SEASON SUMMARY"
    code = "SEAS"

    def subtitle(self) -> str:
        return "%s -- %d" % (self.title, self._require_year())

    def ref_code(self):
        return self._default_ref("%d" % self._require_year())

    # -- column geometry ---------------------------------------------------
    def _columns(self) -> ColumnSet:
        if self.config.is_wide():
            return ColumnSet(
                [
                    Column("rank", "RK", 4, kind="text", align="right"),
                    Column("stnid", "STN", 8, kind="text", align="left"),
                    Column("name", "STATION", 14, kind="text", align="left"),
                    Column("region", "REGION", 16, kind="text", align="left"),
                    Column("yield_t", "YIELD", 9, kind="float", decimals=3,
                           unit="t/ha"),
                    Column("share", "SHARE", 7, kind="pct", decimals=1,
                           unit="%"),
                    Column("ndays", "DAYS", 6, kind="int"),
                    Column("model", "MODEL", 14, kind="text", align="left"),
                    Column("run_at", "RUN AT", 20, kind="text", align="left"),
                ]
            )
        # 80-column: drop region/model/run_at, keep the essentials.
        return ColumnSet(
            [
                Column("rank", "RK", 4, kind="text", align="right"),
                Column("stnid", "STN", 8, kind="text", align="left"),
                Column("name", "STATION", 12, kind="text", align="left"),
                Column("yield_t", "YIELD", 10, kind="float", decimals=3,
                       unit="t/ha"),
                Column("share", "SHARE", 8, kind="pct", decimals=1, unit="%"),
                Column("ndays", "DAYS", 7, kind="int"),
                Column("model", "MODEL", 13, kind="text", align="left"),
            ]
        )

    # -- body --------------------------------------------------------------
    def build_blocks(self) -> List[Block]:
        year = self._require_year()
        forecasts = self.db.forecasts_for_year(year)
        if not forecasts:
            raise ReportError("no forecasts on file for year %d" % year)

        total_yield = sum(f.yield_t for f in forecasts)
        n = len(forecasts)
        mean_yield = total_yield / n if n else 0.0

        # Rank by yield descending; a stable sort keeps station order on
        # ties so the printout is deterministic run to run.
        ordered = sorted(forecasts, key=lambda f: (-f.yield_t, f.stnid))

        rows = []
        for i, f in enumerate(ordered, start=1):
            share = (f.yield_t / total_yield * 100.0) if total_yield else 0.0
            rows.append(
                {
                    "rank": "%d)" % i,
                    "stnid": f.stnid,
                    "name": long_name(f.stnid),
                    "region": region_of(f.stnid),
                    "yield_t": f.yield_t,
                    "share": share,
                    "ndays": f.ndays,
                    "model": f.model,
                    "run_at": f.run_at,
                }
            )

        cols = self._columns()
        table = Block(
            heading="PER-STATION FORECAST YIELD (RANKED)",
            columns=cols,
            rows=rows,
        )

        summary = self._summary_block(total_yield, mean_yield, n, ordered)
        return [table, summary]

    def _summary_block(self, total, mean, n, ordered) -> Block:
        """The provincial total/mean footer plus a couple of derived
        lines (spread, leader) the ministry likes to see called out."""
        roster_size = len(self.db.all_station_ids()) or n
        best = ordered[0]
        worst = ordered[-1]
        spread = best.yield_t - worst.yield_t

        lines = [
            "",
            "  PROVINCIAL TOTAL yield ....... %10.3f t/ha" % total,
            "  PROVINCIAL MEAN  yield ....... %10.3f t/ha" % mean,
            "  Stations reporting ........... %d of %d" % (n, roster_size),
            "  Leading station .............. %-10s (%.3f t/ha)"
            % (best.stnid, best.yield_t),
            "  Trailing station ............. %-10s (%.3f t/ha)"
            % (worst.stnid, worst.yield_t),
            "  Yield spread ................. %10.3f t/ha" % spread,
        ]
        if n < roster_size:
            missing = self._missing_stations(ordered)
            lines.append(
                "  NOTE: no forecast for %s -- excluded from mean."
                % ", ".join(missing)
            )
        return Block(heading="PROVINCIAL SUMMARY", text_lines=lines)

    def _missing_stations(self, ordered) -> List[str]:
        have = {f.stnid for f in ordered}
        roster = self.db.all_station_ids()
        return [s for s in roster if s not in have] or ["(unknown)"]
