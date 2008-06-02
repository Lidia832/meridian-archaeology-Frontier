"""Exception hierarchy for the analytics subsystem.

Added 2020-11 (newer maintainer) when the batch runner grew enough that
"it raised RuntimeError somewhere" stopped being a useful bug report.
The two halves of the subsystem raise from disjoint parts of this tree:

  * Orchestration (Nightshift) raises ConfigError, ScratchError,
    DeckError, QCError and ModelRunError.
  * Output (Archive) raises ParseError, StoreError, AggregateError and
    ExportError.

Everything derives from MeridianError so a caller that only wants to
know "did the run for this station-year fail" can catch one class.
"""
from __future__ import annotations

from typing import Optional


class MeridianError(Exception):
    """Root of every error the analytics subsystem raises on purpose.

    Carries an optional station-year context so a batch log line can say
    which run died without the caller having to thread it back through.
    """

    def __init__(self, message: str, *, stnid: Optional[str] = None,
                 year: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.stnid = stnid
        self.year = year

    def context(self) -> str:
        if self.stnid is not None and self.year is not None:
            return "%s %s" % (self.stnid, self.year)
        if self.stnid is not None:
            return str(self.stnid)
        return ""

    def __str__(self) -> str:
        ctx = self.context()
        if ctx:
            return "[%s] %s" % (ctx, self.message)
        return self.message


# --------------------------------------------------------------------------
# Orchestration side (Nightshift)
# --------------------------------------------------------------------------
class ConfigError(MeridianError):
    """A configuration value is missing, malformed or out of range."""


class ScratchError(MeridianError):
    """A scratch directory could not be created, locked or cleaned up.

    Because cropmod insists on fixed filenames in its CWD (MRD-201) the
    scratch machinery is load bearing; a failure here means the run
    cannot proceed safely.
    """


class DeckError(MeridianError):
    """The fixed-width input deck could not be written as specified.

    Raised when a field will not fit its column width, which would shift
    every column after it and silently corrupt the deck.
    """


class QCError(MeridianError):
    """Input readings failed a quality-control check that blocks a run."""


class ModelRunError(MeridianError):
    """The cropmod binary failed to run or produced no usable output."""


# --------------------------------------------------------------------------
# Output side (Archive)
# --------------------------------------------------------------------------
class ParseError(MeridianError):
    """The cropmod output could not be parsed against OUTFMT.txt."""


class StoreError(MeridianError):
    """A persistence operation against the SQLite store failed."""


class AggregateError(MeridianError):
    """A season summary could not be computed from stored daily rows."""


class ExportError(MeridianError):
    """The export handoff to the reporting subsystem could not be built."""
