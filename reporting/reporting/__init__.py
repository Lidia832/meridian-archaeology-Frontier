"""Meridian reporting subsystem -- fixed-format report writer.

This package reads the Meridian forecast store (the SQLite tables the
analytics subsystem writes) and produces the operational reports the
provincial agri-environmental monitoring programme prints and files:
season summaries, per-station histories, daily forecast detail, data-
quality/anomaly listings and coverage grids.

It is the newest corner of the Meridian pipeline.  It replaced a COBOL
report writer (RPTGEN) that had been in service since the early 1990s;
the plaintext rewrite in 1997 kept the COBOL writer's fixed-format output
close enough that a decade of archived printouts still line up column for
column with what this package prints today.  That fidelity is the whole
point: the ministry's filing system is column positions on paper.

Public surface:
    from reporting.config import ReportConfig
    from reporting.cli import run_report, main

Layout:
    db.py         read-only accessor over the SQLite store
    config.py     ReportConfig -- one run's parameters
    constants.py  station roster, units, flag bits
    format/       the fixed-format engine (columns, banner, layout, emit)
    reports/      one module per report type, wired via reports.registry
    cli.py        argparse front end (python -m reporting ...)
"""
from __future__ import annotations

from .version import __version__, version_string

__all__ = ["__version__", "version_string"]
