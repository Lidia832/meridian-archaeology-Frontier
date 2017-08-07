"""Report types for the Meridian reporting subsystem.

Each module in this package implements one report against the forecast
store: season summary, station report, daily detail, anomaly/data-quality
and coverage.  They all subclass BaseReport and are wired into the CLI
through the registry, so adding a report is: write the module, add it to
registry._REPORTS, done.

    See registry.py for the name -> class table.
"""
from __future__ import annotations

from .base import BaseReport, ReportError
from .registry import get_report_class, report_names, report_titles

__all__ = [
    "BaseReport",
    "ReportError",
    "get_report_class",
    "report_names",
    "report_titles",
]
