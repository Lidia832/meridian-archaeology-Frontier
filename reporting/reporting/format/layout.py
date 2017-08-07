"""Page layout: pagination, running headers, footers, form feeds.

A report body is a stream of lines.  This module turns that stream into
*pages*: it inserts a running header (a short one-line reminder of what
the report is) and a footer (page number, writer version, timestamp) at
the top and bottom of each page, throws a form-feed between pages, and
keeps a running line count so a table that spills past the bottom of the
greenbar is broken cleanly with the column header re-printed on the next
page instead of orphaned.

The ministry prints on fan-fold stock -- 66 lines to a 11" page at 6 lpi
for the narrow stock, taller for the wide -- so the page length is a
property of the width.  Form feed is a literal ASCII FF (0x0C); the line
printers respect it, and it is harmless in a text file (most pagers show
it as ^L).

    P. Adeyemi, 2021.  Extracted from season_summary where the pagination
    logic had been copy-pasted into every report.  MRD-190.
"""
from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field
from typing import List, Optional

from ..version import version_string

FORM_FEED = "\f"


@dataclass
class PageContext:
    """Everything the header/footer need to render themselves.

    running_title -- one-line reminder printed at the top of pages 2..n
    ref_code      -- ministry reference echoed in the footer
    generated_at  -- run timestamp echoed in the footer
    total_hint    -- optional 'of N' page total (filled after layout when
                     known; None prints 'Page k' with no total)
    """

    running_title: str
    width: int
    lines_per_page: int
    ref_code: Optional[str] = None
    generated_at: _dt.datetime = field(default_factory=_dt.datetime.now)
    total_hint: Optional[int] = None


class Paginator:
    """Breaks a body into pages and decorates each one.

    Two kinds of content are fed in:
      * a *preamble* (the banner) that appears once, at the very top, and
        is allowed to be as long as it likes -- it is not counted against
        the first page's body budget beyond reserving its own lines;
      * the *body*, a list of (line, breakable) pairs where breakable
        marks a line the paginator may follow with a page break.  A table
        header row is fed as non-breakable and re-emitted after a break
        (see repeat_on_break) so a split table keeps its column heads.
    """

    def __init__(self, ctx: PageContext):
        self.ctx = ctx

    def _footer(self, page_no: int) -> List[str]:
        w = self.ctx.width
        stamp = self.ctx.generated_at.strftime("%Y-%m-%d %H:%M")
        left = self.ctx.ref_code or ""
        if self.ctx.total_hint:
            mid = "Page %d of %d" % (page_no, self.ctx.total_hint)
        else:
            mid = "Page %d" % page_no
        right = "%s  %s" % (version_string(), stamp)
        rule = "-" * w
        # left ... mid ... right, mid centred, clipped to width.
        line = left.ljust(w)
        line = _overlay(line, mid.center(w))
        line = _overlay(line, right.rjust(w))
        return [rule, line[:w]]

    def _running_header(self, page_no: int) -> List[str]:
        if page_no == 1:
            return []  # page 1 already has the full banner
        w = self.ctx.width
        title = self.ctx.running_title[:w]
        cont = "(continued)"
        line = title.ljust(w)
        line = _overlay(line, cont.rjust(w))
        return [line[:w], "-" * w]

    def paginate(
        self,
        preamble: List[str],
        body: List["BodyLine"],
        repeat_on_break: Optional[List[str]] = None,
    ) -> List[str]:
        """Return the fully-decorated, paginated line list.

        repeat_on_break -- lines (typically a table header) reprinted at
        the top of every page after the first so a table that spans pages
        stays readable.
        """
        per_page = self.ctx.lines_per_page
        pages: List[List[str]] = []
        page: List[str] = []

        # Reserve room for the footer (2 lines) on every page, and for the
        # running header on pages after the first.
        footer_reserve = 2

        def budget(page_no: int) -> int:
            header_lines = 0 if page_no == 1 else 2
            return per_page - footer_reserve - header_lines

        page_no = 1
        # Page 1 opens with the banner preamble.
        page.extend(preamble)
        used = len(preamble)
        if repeat_on_break:
            page.extend(repeat_on_break)
            used += len(repeat_on_break)

        for bl in body:
            if used >= budget(page_no) and bl.breakable_before:
                pages.append(page)
                page_no += 1
                page = []
                page.extend(self._running_header(page_no))
                if repeat_on_break:
                    page.extend(repeat_on_break)
                used = len(page)
            page.append(bl.text)
            used += 1
        pages.append(page)

        # Now we know the page count; stamp footers with 'of N'.
        self.ctx.total_hint = len(pages)
        out: List[str] = []
        for i, pg in enumerate(pages, start=1):
            out.extend(pg)
            # pad the page out so the footer sits at the bottom band; we
            # do not pad the *last* page (a short final page is normal).
            if i < len(pages):
                pad = self.ctx.lines_per_page - len(pg) - 2
                out.extend([""] * max(pad, 0))
            out.extend(self._footer(i))
            if i < len(pages):
                out.append(FORM_FEED)
        return out


@dataclass
class BodyLine:
    """One line of report body plus whether a page break may precede it."""

    text: str
    breakable_before: bool = True


def as_body(lines, breakable=True) -> List[BodyLine]:
    """Wrap a list of plain strings as BodyLines with a common breakability."""
    return [BodyLine(ln, breakable) for ln in lines]


def _overlay(base: str, over: str) -> str:
    """Overlay `over` onto `base` wherever `over` has a non-space char.

    Lets us place left/centre/right fields on one line without them
    clobbering each other's blanks.  Both strings are the page width.
    """
    b = list(base)
    for i, ch in enumerate(over):
        if i >= len(b):
            break
        if ch != " ":
            b[i] = ch
    return "".join(b)
