"""Anomaly / Data-Quality report.

Lists the readings the collector flagged suspect (flags & 0x1) and counts
them per station, so a data manager can see at a glance which sites are
producing dirty telemetry and chase the sensor.  This report reads the
`reading` table, not the forecast tables -- it is about the inputs, not
the outputs -- so it has no forecast run to stamp in its banner.

Two parts:
  * a per-station SUMMARY: suspect count, total readings, and the suspect
    rate as a percentage, ranked worst-first so the problem sites float
    to the top;
  * an itemised DETAIL table of every suspect reading with its values, so
    the flagged rows can actually be looked at.  The detail can be large,
    which is exactly why the paginator re-prints the column header on
    each page.

    P. Adeyemi, 2023.  Grew out of the coverage report when the ministry
    started asking "how much of this is any good?" as well as "how much
    is there?".
"""
from __future__ import annotations

from typing import List, Optional

from ..constants import flag_labels, long_name
from ..format import Block, Column, ColumnSet
from .base import BaseReport, ReportError


class AnomalyReport(BaseReport):
    name = "anomaly"
    title = "DATA-QUALITY / ANOMALY REPORT"
    code = "ANOM"

    def subtitle(self) -> str:
        if self.config.year is not None:
            return "%s -- %d" % (self.title, self.config.year)
        return "%s -- ALL YEARS" % self.title

    def ref_code(self):
        scope = "%d" % self.config.year if self.config.year is not None else "ALL"
        return self._default_ref(scope)

    # This report is about readings; there is no forecast run behind it.
    def _source_run_at(self) -> Optional[str]:
        return None

    def _summary_columns(self) -> ColumnSet:
        return ColumnSet(
            [
                Column("stnid", "STN", 8, kind="text", align="left"),
                Column("name", "STATION", 12, kind="text", align="left"),
                Column("suspect", "SUSPECT", 9, kind="int"),
                Column("total", "TOTAL", 9, kind="int"),
                Column("rate", "RATE", 8, kind="pct", decimals=2, unit="%"),
            ]
        )

    def _detail_columns(self) -> ColumnSet:
        cols = [
            Column("stnid", "STN", 8, kind="text", align="left"),
            Column("year", "YEAR", 6, kind="int"),
            Column("doy", "DOY", 4, kind="int"),
            Column("tmax", "TMAX", 8, kind="float", decimals=1, unit="degC"),
            Column("tmin", "TMIN", 8, kind="float", decimals=1, unit="degC"),
            Column("rain", "RAIN", 8, kind="float", decimals=1, unit="mm"),
        ]
        if self.config.is_wide():
            cols += [
                Column("srad", "SRAD", 8, kind="float", decimals=1,
                       unit="MJ/m2"),
                Column("rh", "RH", 7, kind="float", decimals=1, unit="%"),
                Column("wind", "WIND", 7, kind="float", decimals=1,
                       unit="m/s"),
            ]
        cols.append(Column("flag", "FLAGS", 9, kind="text", align="left"))
        return ColumnSet(cols)

    def build_blocks(self) -> List[Block]:
        year = self.config.year  # optional filter
        stn = self.config.normalized_station()  # optional filter

        counts = self.db.suspect_counts(year=year)
        if stn is not None:
            counts = [c for c in counts if c[0] == stn]

        # Rank stations by suspect rate descending; a site with no
        # readings at all is dropped from the summary rather than dividing
        # by zero.
        summ_rows = []
        for stnid, sus, total in counts:
            if total == 0:
                continue
            rate = sus / total * 100.0
            summ_rows.append(
                {
                    "stnid": stnid,
                    "name": long_name(stnid),
                    "suspect": sus,
                    "total": total,
                    "rate": rate,
                }
            )
        summ_rows.sort(key=lambda r: (-r["rate"], r["stnid"]))

        summary = Block(
            heading="SUSPECT COUNTS BY STATION",
            columns=self._summary_columns(),
            rows=summ_rows,
        )

        suspects = self.db.suspect_readings(year=year, stnid=stn)
        detail_rows = [
            {
                "stnid": r.stnid,
                "year": r.year,
                "doy": r.doy,
                "tmax": r.tmax,
                "tmin": r.tmin,
                "rain": r.rain,
                "srad": r.srad,
                "rh": r.rh,
                "wind": r.wind,
                "flag": flag_labels(r.flags),
            }
            for r in suspects
        ]

        total_suspect = sum(r["suspect"] for r in summ_rows)
        head = Block(
            heading="OVERVIEW",
            text_lines=[
                "  Scope ................ %s"
                % (("year %d" % year) if year is not None else "all years"),
                "  Station filter ....... %s" % (stn or "(all stations)"),
                "  Suspect readings ..... %d" % total_suspect,
                "  Flag tested .......... 0x0001 (suspect)",
            ],
        )

        if not detail_rows:
            note = Block(
                heading="SUSPECT READINGS (DETAIL)",
                text_lines=["  No suspect readings match the current scope."],
            )
            return [head, summary, note]

        detail = Block(
            heading="SUSPECT READINGS (DETAIL)",
            columns=self._detail_columns(),
            rows=detail_rows,
        )
        return [head, summary, detail]
