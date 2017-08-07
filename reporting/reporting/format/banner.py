"""Letterhead / banner block for the top of every report.

Every printout the ministry files opens with the same block: a ruled
box, the programme name, the report title, and a strip of run metadata
(who ran it, when, from which store, which version of this writer).
That banner is how a page that has been photocopied and re-filed three
times can still be traced back to the run that produced it, so its
wording is treated as part of the fixed-format contract even though it
is not machine-read.

The 80- and 132-column variants share this code; the width just changes
how wide the ruled box is and whether the metadata sits on one line or
two.

    Programme title fixed by ministry style guide (rev. 2016).
    Banner box widened to 132 by P. Adeyemi, 2021.
"""
from __future__ import annotations

import datetime as _dt
import getpass
import os
from typing import List, Optional

from ..version import version_string
from . import numfmt

PROGRAMME_TITLE = "PROVINCIAL AGRI-ENVIRONMENTAL MONITORING"
REPORT_TITLE = "YIELD FORECAST REPORT"

# The box is drawn with plain ASCII so it survives a line printer, a fax
# and a bad photocopy.  '=' for the heavy rules, '-' for the light one.
HEAVY = "="
LIGHT = "-"


def _rule(width: int, ch: str = HEAVY) -> str:
    return ch * width


def _centered(text: str, width: int) -> str:
    text = text.strip()
    if len(text) >= width:
        return text[:width]
    return text.center(width)


def _who() -> str:
    """Best-effort operator id for the run-by line.

    In batch this is whatever user the cron runs as; interactively it is
    the clerk at the terminal.  We never fail a report over not being
    able to read the username -- a report with 'unknown' in the header is
    better than no report.
    """
    try:
        return getpass.getuser()
    except Exception:  # pragma: no cover - platform dependent
        return os.environ.get("USER", "unknown")


def build_banner(
    subtitle: str,
    width: int,
    *,
    db_path: str,
    generated_at: Optional[_dt.datetime] = None,
    source_run_at: Optional[str] = None,
    note: Optional[str] = None,
    ref_code: Optional[str] = None,
) -> List[str]:
    """Return the banner as a list of lines (no trailing newlines).

    subtitle      -- report-specific line, e.g. 'SEASON SUMMARY -- 2021'
    width         -- 80 or 132
    db_path       -- store the report read
    generated_at  -- wall-clock time of this run (defaults to now)
    source_run_at -- newest forecast run_at the data came from
    note          -- optional free-text stamp from the operator
    ref_code      -- ministry file reference, e.g. 'SEAS-2021'
    """
    if generated_at is None:
        generated_at = _dt.datetime.now()

    lines: List[str] = []
    lines.append(_rule(width, HEAVY))
    lines.append(_centered(PROGRAMME_TITLE, width))
    lines.append(_centered(REPORT_TITLE, width))
    if subtitle:
        lines.append(_centered(subtitle, width))
    lines.append(_rule(width, HEAVY))

    # Metadata strip.  On 80 columns we stack the fields two per line; on
    # 132 they fit on one line each with room to spare.
    gen = generated_at.strftime("%Y-%m-%d %H:%M")
    run_by = _who()
    src = source_run_at or "(none)"

    meta_pairs = [
        ("Generated", gen),
        ("Run by", run_by),
        ("Store", numfmt.truncate_middle(db_path, min(48, width - 20))),
        ("Data run", src),
        ("Writer", version_string()),
    ]
    if ref_code:
        meta_pairs.insert(0, ("Reference", ref_code))
    if note:
        meta_pairs.append(("Note", numfmt.truncate_middle(note, min(60, width - 20))))

    if width >= 132:
        for label, val in meta_pairs:
            lines.append("  %-12s : %s" % (label, val))
    else:
        # Two-up on the narrow page.
        buf = ""
        for i, (label, val) in enumerate(meta_pairs):
            field = "%-10s: %s" % (label, val)
            if i % 2 == 0:
                buf = "  " + field
            else:
                # pad the first field so the second starts at a fixed col
                left = buf.ljust(40)
                lines.append((left + field)[:width])
                buf = ""
        if buf:
            lines.append(buf[:width])
    lines.append(_rule(width, LIGHT))
    return lines


def build_section_head(title: str, width: int, ch: str = LIGHT) -> List[str]:
    """A minor section header used inside multi-part reports (e.g. the
    'PER-STATION DETAIL' block under a summary)."""
    title = " " + title.strip() + " "
    if len(title) >= width:
        return [title[:width]]
    dash = (width - len(title)) // 2
    line = ch * dash + title + ch * (width - dash - len(title))
    return [line]
