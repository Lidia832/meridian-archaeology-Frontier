"""Numeric field formatting for fixed-width reports.

The whole point of these reports is that a column is exactly W characters
wide, every time, so a stack of printouts lines up and a clerk can run a
ruler down a column of numbers.  That means every value has to be coerced
into its field width, and a value that will not fit has to be handled
deliberately -- we borrow the model output's convention (docs/OUTFMT.txt,
MRD-143) and print a field of asterisks rather than a truncated or
misaligned number that would silently lie.

Nothing here allocates or formats a whole line; these are the primitives
the column engine calls one field at a time.

    R. Halloran, 2017.  Overflow-to-asterisks lifted from the FORTRAN
    output handling so the two subsystems agree on what a bad field
    looks like.
"""
from __future__ import annotations

from typing import Optional

from ..constants import OVERFLOW_MARK

# What we print for a missing (NULL) value.  A dot, right-justified, is
# the ministry's long-standing convention for "no data" as opposed to a
# genuine zero.  The COBOL writer used LOW-VALUES here which printed as
# blanks; the dot is friendlier on a photocopy.
MISSING_MARK = "."


def overflow(width: int) -> str:
    """A full field of asterisks, width characters wide."""
    return OVERFLOW_MARK * max(width, 1)


def missing(width: int) -> str:
    """Right-justified missing-value marker in a field of the given width."""
    return MISSING_MARK.rjust(width)


def fixed(value: Optional[float], width: int, decimals: int) -> str:
    """Format a float right-justified in `width` with `decimals` places.

    Returns a field exactly `width` characters wide.  A None becomes the
    missing marker; a value whose rendered form is wider than the field
    becomes a run of asterisks (never a truncated number).
    """
    if value is None:
        return missing(width)
    try:
        s = "%.*f" % (decimals, float(value))
    except (TypeError, ValueError):
        return overflow(width)
    # Guard against "-0.00" which looks like a data problem to a reader.
    if s.startswith("-") and float(s) == 0.0:
        s = s[1:]
    if len(s) > width:
        return overflow(width)
    return s.rjust(width)


def integer(value: Optional[int], width: int) -> str:
    """Right-justified integer field of exactly `width` characters."""
    if value is None:
        return missing(width)
    try:
        s = "%d" % int(value)
    except (TypeError, ValueError):
        return overflow(width)
    if len(s) > width:
        return overflow(width)
    return s.rjust(width)


def text(value: Optional[str], width: int, align: str = "left") -> str:
    """Fit a string into a fixed field.

    Unlike numbers, an over-long *label* is truncated rather than turned
    to asterisks -- a clipped station name is still readable, a clipped
    number is a lie.  A truncation is marked with a trailing '>' so a
    reader knows the value ran long, matching the greenbar convention.
    """
    if value is None:
        value = ""
    value = str(value)
    if len(value) > width:
        if width <= 1:
            return value[:width]
        return value[: width - 1] + ">"
    if align == "right":
        return value.rjust(width)
    if align == "center":
        return value.center(width)
    return value.ljust(width)


def percent(value: Optional[float], width: int, decimals: int = 1) -> str:
    """A value already expressed 0..100 formatted with a trailing space
    for the (implied) percent sign, right justified."""
    if value is None:
        return missing(width)
    return fixed(value, width, decimals)


def signed_delta(value: Optional[float], width: int, decimals: int) -> str:
    """Like `fixed` but always shows a sign, for trend/delta columns.

    A rise of 0.30 prints as '+0.30', a fall as '-0.30'.  Zero prints as
    a bare '0.00' with no sign because a signed zero reads as noise.
    """
    if value is None:
        return missing(width)
    try:
        v = float(value)
    except (TypeError, ValueError):
        return overflow(width)
    if v == 0.0:
        s = "%.*f" % (decimals, 0.0)
    elif v > 0:
        s = "+" + ("%.*f" % (decimals, v))
    else:
        s = "%.*f" % (decimals, v)  # the '-' comes for free
    if len(s) > width:
        return overflow(width)
    return s.rjust(width)


def rank_marker(rank: int, width: int = 3) -> str:
    """A small ordinal like ' 1)' used to number ranked rows."""
    s = "%d)" % rank
    return s.rjust(width)


def truncate_middle(value: str, width: int) -> str:
    """Ellipsize the middle of an over-long label, keeping both ends.

    Used for file paths and run timestamps in footers where the tail is
    as meaningful as the head.  Uses '..' (two dots) rather than a real
    ellipsis so the output stays 7-bit ASCII for the line printer.
    """
    if len(value) <= width:
        return value
    if width <= 2:
        return value[:width]
    keep = width - 2
    head = (keep + 1) // 2
    tail = keep - head
    return value[:head] + ".." + (value[-tail:] if tail else "")
