"""Column-spec engine for the fixed-format tables.

A report table is described declaratively as a list of Column objects.
Each column knows its width, how to align its header, and how to render
one cell (which delegates to numfmt).  A ColumnSet then lays a whole row
out by walking its columns and joining the cells with a single space
gutter -- the same one-space gutter the model output uses between its
fields so the two subsystems' printouts have the same texture.

The engine is deliberately dumb: it does not know what a season summary
is, only how to turn a list of column specs plus a row of values into a
line of exactly the right width.  That separation is what let the 132-col
layout be added in 2021 without touching any report's logic -- a wide
report just hands the engine wider column specs.

    R. Halloran, 2017; widened-field support P. Adeyemi, 2021.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Optional, Sequence

from . import numfmt

# One space between columns, matching docs/OUTFMT.txt's I4,1X,F7.2,...
GUTTER = " "


@dataclass
class Column:
    """One column of a fixed-width table.

    key      -- dictionary key used to pull the value out of a row dict
    title    -- header caption (may be clipped to width)
    width    -- field width in characters
    kind     -- 'int' | 'float' | 'text' | 'delta' | 'pct' | 'raw'
    decimals -- for float/delta/pct columns
    align    -- header/text alignment: 'left' | 'right' | 'center'
    unit     -- optional unit string for the sub-header row
    """

    key: str
    title: str
    width: int
    kind: str = "text"
    decimals: int = 2
    align: str = "right"
    unit: Optional[str] = None
    # Escape hatch: a column may supply its own renderer for a value,
    # used by the anomaly report's flag column.  Signature (value)->str;
    # the result is fitted to width with the column's alignment.
    render: Optional[Callable[[object], str]] = None

    def header_cell(self) -> str:
        # Headers are clipped, never asterisked -- a clipped caption is
        # still legible.  Numeric columns get right-aligned captions so
        # the caption sits over the ones digit.
        align = "right" if self.kind in ("int", "float", "delta", "pct") else self.align
        return numfmt.text(self.title, self.width, align)

    def unit_cell(self) -> str:
        return numfmt.text(self.unit or "", self.width, "right")

    def cell(self, value) -> str:
        if self.render is not None:
            return numfmt.text(self.render(value), self.width, self.align)
        if self.kind == "int":
            return numfmt.integer(value, self.width)
        if self.kind == "float":
            return numfmt.fixed(value, self.width, self.decimals)
        if self.kind == "delta":
            return numfmt.signed_delta(value, self.width, self.decimals)
        if self.kind == "pct":
            return numfmt.percent(value, self.width, self.decimals)
        # 'text'/'raw'
        return numfmt.text("" if value is None else str(value), self.width, self.align)


class ColumnSet:
    """An ordered set of Columns that renders whole rows.

    The total rendered width is the sum of the column widths plus one
    gutter between each pair.  A report picks a ColumnSet sized for its
    target page width; if the columns do not add up the report is asked
    to fix its specs rather than have the engine silently pad, because a
    quietly-padded table is one that no longer lines up with last year's.
    """

    def __init__(self, columns: Sequence[Column]):
        self.columns: List[Column] = list(columns)

    @property
    def width(self) -> int:
        if not self.columns:
            return 0
        return sum(c.width for c in self.columns) + (len(self.columns) - 1) * len(GUTTER)

    def header_line(self) -> str:
        return GUTTER.join(c.header_cell() for c in self.columns)

    def unit_line(self) -> str:
        return GUTTER.join(c.unit_cell() for c in self.columns)

    def has_units(self) -> bool:
        return any(c.unit for c in self.columns)

    def rule(self, ch: str = "-") -> str:
        """A rule matching the table width, e.g. a line of dashes under
        the header.  We rule per-column (dashes under each field, spaces
        in the gutters) so the eye can tell one column from the next."""
        return GUTTER.join(ch * c.width for c in self.columns)

    def row_line(self, row: dict) -> str:
        cells = []
        for c in self.columns:
            cells.append(c.cell(row.get(c.key)))
        return GUTTER.join(cells)

    def fits(self, page_width: int) -> bool:
        return self.width <= page_width

    def keys(self) -> List[str]:
        return [c.key for c in self.columns]


def leftpad_block(lines: Sequence[str], pad: int) -> List[str]:
    """Indent a block of already-rendered lines by `pad` spaces.

    Used to centre a narrow table on a wide page; the caller computes the
    pad from (page_width - table_width)//2.
    """
    prefix = " " * max(pad, 0)
    return [prefix + ln for ln in lines]


def center_block(lines: Sequence[str], table_width: int, page_width: int) -> List[str]:
    pad = max((page_width - table_width) // 2, 0)
    return leftpad_block(lines, pad)
