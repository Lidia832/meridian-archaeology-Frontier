"""Input quality control, run before the model sees a deck.

    -- Nightshift (orchestration) side --

cropmod does not validate its input.  It assumes daily records are in
ascending DOY order and does not check (MRD-118), it does not
interpolate gaps, and a decoding error upstream (a stuck sensor, a
mis-scaled channel) will produce a confident, wrong yield rather than an
error.  QC is the last place to catch that before four hours of batch
time turns bad input into bad forecasts.

QC classifies findings by severity.  ERRORs block the run when
``qc_blocking`` is set; WARNINGs never block but are recorded so the
batch report can surface them.  The checks here are intentionally about
*decodability and shape*, not agronomy: we are guarding the model's
assumptions, not judging the weather.

Added 2023 (newer maintainer).  Before this, the only QC was the model
crashing on a truly malformed deck, which by then was too late.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Sequence

from .config import QCLimits
from .errors import QCError
from .results import ModelInputSpec


class Severity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass(frozen=True)
class Finding:
    severity: Severity
    code: str
    message: str
    doy: int = -1

    def __str__(self) -> str:
        where = "" if self.doy < 0 else " (doy %d)" % self.doy
        return "%s %s: %s%s" % (self.severity.value.upper(), self.code,
                                self.message, where)


@dataclass
class QCReport:
    stnid: str
    year: int
    findings: List[Finding] = field(default_factory=list)

    def add(self, severity: Severity, code: str, message: str,
            doy: int = -1) -> None:
        self.findings.append(Finding(severity, code, message, doy))

    def errors(self) -> List[Finding]:
        return [f for f in self.findings if f.severity is Severity.ERROR]

    def warnings(self) -> List[Finding]:
        return [f for f in self.findings if f.severity is Severity.WARNING]

    @property
    def ok(self) -> bool:
        """True when nothing would block a run (no ERROR findings)."""
        return not self.errors()

    def summary(self) -> str:
        return ("%s %d: %d error(s), %d warning(s)"
                % (self.stnid, self.year, len(self.errors()),
                   len(self.warnings())))


class QC:
    """Runs the check suite over a ModelInputSpec."""

    def __init__(self, limits: QCLimits):
        self.limits = limits

    def check(self, spec: ModelInputSpec) -> QCReport:
        report = QCReport(stnid=spec.stnid, year=spec.year)
        self._check_present(spec, report)
        if not spec.readings:
            return report  # nothing else is meaningful
        self._check_length(spec, report)
        self._check_monotonic(spec, report)
        self._check_gaps(spec, report)
        self._check_ranges(spec, report)
        self._check_tmax_tmin(spec, report)
        self._check_soil(spec, report)
        return report

    # -- individual checks -------------------------------------------------
    def _check_present(self, spec: ModelInputSpec, report: QCReport) -> None:
        if not spec.readings:
            report.add(Severity.ERROR, "NODATA",
                       "no readings for station-year")

    def _check_length(self, spec: ModelInputSpec, report: QCReport) -> None:
        if spec.ndays < self.limits.min_days:
            report.add(Severity.ERROR, "SHORT",
                       "season has %d days, minimum is %d"
                       % (spec.ndays, self.limits.min_days))

    def _check_monotonic(self, spec: ModelInputSpec,
                         report: QCReport) -> None:
        """Ascending, strictly increasing DOY.

        cropmod assumes this and does not check (MRD-118).  Out-of-order
        or duplicate days give a silently wrong water balance, so here it
        is an ERROR: better to fail than to forecast from a scrambled
        season.
        """
        prev = None
        for r in spec.readings:
            if prev is not None:
                if r.doy == prev:
                    report.add(Severity.ERROR, "DUPDOY",
                               "duplicate day of year", doy=r.doy)
                elif r.doy < prev:
                    report.add(Severity.ERROR, "ORDER",
                               "day of year %d follows %d (not ascending)"
                               % (r.doy, prev), doy=r.doy)
            prev = r.doy

    def _check_gaps(self, spec: ModelInputSpec, report: QCReport) -> None:
        doys = spec.doys()
        if len(doys) < 2:
            return
        biggest = 0
        total_missing = 0
        for a, b in zip(doys, doys[1:]):
            gap = b - a - 1
            if gap > 0:
                total_missing += gap
                biggest = max(biggest, gap)
                if gap >= 3:
                    report.add(Severity.WARNING, "GAP",
                               "%d missing day(s) before doy %d" % (gap, b),
                               doy=b)
        if biggest > self.limits.max_interior_gap_days:
            report.add(Severity.ERROR, "BIGGAP",
                       "largest interior gap is %d days (max %d)"
                       % (biggest, self.limits.max_interior_gap_days))
        elif total_missing > 0:
            report.add(Severity.INFO, "MISSING",
                       "%d interior day(s) missing overall" % total_missing)

    def _check_ranges(self, spec: ModelInputSpec, report: QCReport) -> None:
        lim = self.limits
        for r in spec.readings:
            self._range(report, "tmax", r.tmax, lim.tmax_min, lim.tmax_max,
                        r.doy)
            self._range(report, "tmin", r.tmin, lim.tmin_min, lim.tmin_max,
                        r.doy)
            self._range(report, "rain", r.rain, lim.rain_min, lim.rain_max,
                        r.doy)
            self._range(report, "srad", r.srad, lim.srad_min, lim.srad_max,
                        r.doy)

    def _range(self, report: QCReport, name: str, value: float, lo: float,
               hi: float, doy: int) -> None:
        if value < lo or value > hi:
            report.add(Severity.ERROR, "RANGE",
                       "%s=%.2f outside [%.1f, %.1f]" % (name, value, lo, hi),
                       doy=doy)

    def _check_tmax_tmin(self, spec: ModelInputSpec,
                        report: QCReport) -> None:
        for r in spec.readings:
            if r.tmin > r.tmax:
                report.add(Severity.ERROR, "TMINMAX",
                           "tmin=%.1f exceeds tmax=%.1f" % (r.tmin, r.tmax),
                           doy=r.doy)

    def _check_soil(self, spec: ModelInputSpec, report: QCReport) -> None:
        # awc is a fraction; rooting depth is mm (DECKFMT warns some old
        # files carried cm, giving a profile ten times too small).
        if not (0.0 < spec.awc < 1.0):
            report.add(Severity.WARNING, "AWC",
                       "awc=%.3f is not a fraction in (0,1)" % spec.awc)
        if spec.rooting_depth_mm < 100.0:
            report.add(Severity.WARNING, "RDEPTH",
                       "rooting depth %.1f looks like cm, not mm (DECKFMT)"
                       % spec.rooting_depth_mm)


def check_inputs(spec: ModelInputSpec, limits: QCLimits,
                 blocking: bool = True) -> QCReport:
    """Run QC over a spec; raise QCError if blocking and it has errors."""
    report = QC(limits).check(spec)
    if blocking and not report.ok:
        first = report.errors()[0]
        raise QCError("input QC failed: %s" % first,
                      stnid=spec.stnid, year=spec.year)
    return report
