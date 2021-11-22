"""Version stamp for the reporting subsystem.

The number here is printed on every report footer so the ministry can
tell which generation of the report writer produced a given printout
that has been sitting in a filing cabinet for a decade.  Bump the
last field for a bug fix, the middle for a new report or layout, the
first only when the fixed-format contract itself changes (which has
not happened since the plaintext rewrite).

History (abbreviated; see ISSUES.md in the repo root for the rest):
    2.0.0  1997  plaintext rewrite; retired the COBOL report writer
    2.3.0  2004  CSV emitter added for the spreadsheet crowd
    3.0.0  2011  package restructure, argparse CLI
    3.4.0  2018  season summary rewrite (R. Halloran)
    3.6.0  2021  132-column layout (P. Adeyemi)
    3.6.2  2023  coverage report; anomaly counts per station
"""
from __future__ import annotations

__version__ = "3.6.2"

# The COBOL writer this replaced emitted a version banner too; we keep
# the same three-part shape so old parsing scripts in the ministry do
# not fall over.
VERSION_TUPLE = tuple(int(p) for p in __version__.split("."))


def version_string() -> str:
    """Human string used in footers, e.g. 'v3.6.2'."""
    return "v" + __version__
# 2021-11 P. Adeyemi: 132-column layout added.
