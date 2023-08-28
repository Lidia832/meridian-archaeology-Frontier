"""Coverage report.

Which stations have a forecast for which years, and where the gaps are.
Answers the ministry's perennial "is anything missing?" before a season
summary goes out -- a summary that quietly omits a station because its
forecast never ran is worse than one that flags the hole.

The core is a station x year grid: a mark where a forecast exists, a dot
where it does not.  Below it, a per-station and per-year tally, and a
plain-language list of the actual gaps so nobody has to read the grid to
find them.

At 132 columns the grid can show more years across before it has to wrap;
at 80 we show the most recent span that fits and note how many older
years were elided.

    P. Adeyemi, 2023.  Replaced a spreadsheet a co-op student used to
    maintain by hand every August.
"""
from __future__ import annotations

from typing import Dict, List, Set, Tuple

from ..constants import long_name
from ..format import Block, Column, ColumnSet
from .base import BaseReport, ReportError

PRESENT = "X"
ABSENT = "."


class CoverageReport(BaseReport):
    name = "coverage"
    title = "COVERAGE REPORT"
    code = "COVR"

    def subtitle(self) -> str:
        return self.title

    def ref_code(self):
        return self._default_ref("GRID")

    def build_blocks(self) -> List[Block]:
        presence = set(self.db.forecast_presence())  # {(stnid, year)}
        if not presence:
            raise ReportError("no forecasts on file -- nothing to cover")

        stations = self.db.all_station_ids()
        years = sorted({y for (_s, y) in presence})

        head = self._overview_block(presence, stations, years)
        grid = self._grid_block(presence, stations, years)
        tally, gaps = self._gap_blocks(presence, stations, years)
        return [head, grid, tally, gaps]

    def _overview_block(self, presence, stations, years) -> Block:
        have = len(presence)
        want = len(stations) * len(years)
        pct = (have / want * 100.0) if want else 0.0
        lines = [
            "  Stations ............. %d" % len(stations),
            "  Years ................ %d  (%d..%d)"
            % (len(years), min(years), max(years)),
            "  Cells filled ......... %d of %d  (%.1f%%)" % (have, want, pct),
        ]
        return Block(heading="OVERVIEW", text_lines=lines)

    def _visible_years(self, years: List[int]) -> Tuple[List[int], int]:
        """Pick the span of years that fits the page, newest-biased.

        Returns (years_shown, n_elided).  Each year column is 5 chars
        wide plus a gutter; the station label eats the first ~20 cols.
        """
        label_w = 20
        per_year = 6  # 5-wide field + 1 gutter
        room = (self.config.width - label_w) // per_year
        room = max(room, 1)
        if len(years) <= room:
            return years, 0
        shown = years[-room:]
        return shown, len(years) - len(shown)

    def _grid_block(self, presence, stations, years) -> Block:
        shown, elided = self._visible_years(years)
        cols = [Column("stn", "STATION", 20, kind="text", align="left")]
        for y in shown:
            cols.append(
                Column("y%d" % y, "%d" % y, 5, kind="text", align="center")
            )
        cs = ColumnSet(cols)

        rows = []
        for s in stations:
            row = {"stn": "%-8s %s" % (s, long_name(s))}
            for y in shown:
                row["y%d" % y] = PRESENT if (s, y) in presence else ABSENT
            rows.append(row)

        head_lines = []
        if elided:
            head_lines.append(
                "  (%d earlier year(s) not shown at this width; use --width 132"
                " or CSV)" % elided
            )
        return Block(
            heading="STATION x YEAR COVERAGE",
            head_lines=head_lines,
            columns=cs,
            rows=rows,
            show_units=False,
        )

    def _gap_blocks(self, presence, stations, years):
        """Per-station tally table plus an explicit list of missing cells.

        Returned as two blocks so the tally prints first and the gap list
        (free text, which reads better as sentences than as a column of
        pairs) follows it."""
        tally_cols = ColumnSet(
            [
                Column("stn", "STN", 8, kind="text", align="left"),
                Column("name", "STATION", 14, kind="text", align="left"),
                Column("have", "HAVE", 6, kind="int"),
                Column("miss", "MISS", 6, kind="int"),
            ]
        )
        tally_rows = []
        gap_lines: List[str] = []
        for s in stations:
            have_years = sorted(y for y in years if (s, y) in presence)
            miss_years = [y for y in years if (s, y) not in presence]
            tally_rows.append(
                {
                    "stn": s,
                    "name": long_name(s),
                    "have": len(have_years),
                    "miss": len(miss_years),
                }
            )
            if miss_years:
                gap_lines.append(
                    "  %-8s missing %s"
                    % (s, ", ".join(str(y) for y in miss_years))
                )
        if not gap_lines:
            gap_lines = ["  No gaps: every station has every year on file."]

        tally = Block(
            heading="COVERAGE TALLY",
            columns=tally_cols,
            rows=tally_rows,
        )
        gaps = Block(heading="GAP DETAIL", text_lines=gap_lines)
        return tally, gaps
