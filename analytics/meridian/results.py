"""Data-transfer objects shared across the analytics subsystem.

------------------------------------------------------------------------
THE NIGHTSHIFT / ARCHIVE SEAM
------------------------------------------------------------------------
The analytics subsystem is worked by two teams that do not share code
paths, only data:

    Nightshift (orchestration)          Archive (output)
    -------------------------           ----------------
    config.py   scratch.py              parse.py      store.py
    deck.py     qc.py                   aggregate.py  results objects
    orchestrator (produce side)         exportbridge.py

The seam between them is exactly one object: ``RunArtifacts``.

Nightshift's whole job is to turn a ``ModelInputSpec`` into a
``RunArtifacts`` -- it builds the deck, manages the scratch directory,
runs the cropmod binary, and hands back a small record that says "the
model ran for this station-year and its output is that file on disk".
Nightshift knows nothing about the output column format.

Archive's whole job starts from ``RunArtifacts``: it parses the output
file, turns it into a ``ForecastResult``, summarises it into a
``SeasonSummary`` and persists both.  Archive knows nothing about decks,
scratch directories or the model binary.

Neither side reaches across the seam.  Nightshift never imports parse;
Archive never imports deck.  ``orchestrator.run_station_year`` is the
only place the two are wired together, and it does so purely through the
objects in this module.  Everything here is a plain, frozen value type
with no behaviour that touches the filesystem or the database, so both
teams can depend on it without depending on each other.
------------------------------------------------------------------------
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Sequence, Tuple


# ==========================================================================
# Input side -- produced by Nightshift, consumed by deck/qc
# ==========================================================================
@dataclass(frozen=True)
class InputReading:
    """One day of weather as it goes into the model deck.

    A deliberately narrow view of the ``reading`` table: only the five
    fields the deck carries (DECKFMT.txt daily record).  The store's
    richer Reading type is projected down onto this before it crosses
    into deck-writing code.
    """
    stnid: str
    year: int
    doy: int
    tmax: float
    tmin: float
    rain: float
    srad: float


@dataclass(frozen=True)
class ModelInputSpec:
    """Everything Nightshift needs to run one station-year.

    This is assembled by the orchestrator from the store plus the
    hard-coded soil/latitude registries in deck.py (soil parameters are
    hard coded, MRD-91).  It is what QC inspects and what the deck writer
    renders.
    """
    stnid: str
    year: int
    latitude: float
    awc: float
    rooting_depth_mm: float
    readings: Sequence[InputReading]

    @property
    def ndays(self) -> int:
        return len(self.readings)

    @property
    def profile_capacity_mm(self) -> float:
        """awc (fraction) * rooting depth (mm) -> mm of water (DECKFMT)."""
        return self.awc * self.rooting_depth_mm

    def doys(self) -> List[int]:
        return [r.doy for r in self.readings]


# ==========================================================================
# THE SEAM -- produced by Nightshift, consumed by Archive
# ==========================================================================
@dataclass(frozen=True)
class RunArtifacts:
    """The single object handed from Nightshift to Archive.

    After Nightshift has run the model, this records where the output
    landed and enough provenance for Archive to persist the result.  It
    intentionally does *not* carry parsed values: parsing is Archive's
    responsibility and Archive owns the column format (MRD-143).

    ``out_path`` is valid only while the owning scratch directory is
    alive, so Archive must consume it before the scratch context closes.
    """
    stnid: str
    year: int
    scratch_dir: str
    deck_path: str
    out_path: str
    model_binary: str
    returncode: int
    deck_days: int
    stdout_tail: str = ""

    def describe(self) -> str:
        return "RunArtifacts(%s %d, rc=%d, out=%s)" % (
            self.stnid, self.year, self.returncode, self.out_path)


# ==========================================================================
# Output side -- produced by Archive (parse), consumed by store/aggregate
# ==========================================================================
@dataclass(frozen=True)
class DailyRow:
    """One daily record parsed from MERIDIAN.OUT.

    Column layout is fixed (OUTFMT.txt).  Kept a distinct type from
    InputReading on purpose: these are model *outputs*, and conflating
    the two is how MRD-143 stayed hidden for two seasons.
    """
    doy: int
    sw: float
    et: float
    drain: float
    biom: float
    lai: float


@dataclass(frozen=True)
class ForecastResult:
    """A fully parsed cropmod run, ready to persist.

    This is what ``parse`` returns and what ``store.save_result`` writes.
    The legacy dict shape (``result["yield_t"]`` etc.) is still available
    via :meth:`as_legacy_dict` so run_forecast.py and older callers do
    not break.
    """
    stnid: str
    year: int
    model: str
    ndays: int
    yield_t: float
    rows: Sequence[DailyRow]
    dropped_days: int = 0
    run_at: Optional[str] = None

    @property
    def parsed_days(self) -> int:
        return len(self.rows)

    @property
    def days_match(self) -> bool:
        """Whether every day the banner promised was parsed.

        A mismatch is the fingerprint of MRD-143 firing: an overflowed
        SW field ran DOY and SW together and the day was dropped rather
        than misread.  Not fatal -- recorded so it can be reported.
        """
        return self.parsed_days == self.ndays

    def as_legacy_dict(self) -> Dict:
        return {
            "model": self.model,
            "stnid": self.stnid,
            "year": self.year,
            "ndays": self.ndays,
            "rows": list(self.rows),
            "yield_t": self.yield_t,
        }


# ==========================================================================
# Summary / aggregation -- produced by Archive (aggregate)
# ==========================================================================
@dataclass(frozen=True)
class SeasonSummary:
    """Season-level rollup of one forecast's daily rows.

    Computed by aggregate.py from a ForecastResult (or from stored daily
    rows read back out of the DB).  Reporting-facing numbers live here so
    the exportbridge does not have to re-derive them.
    """
    stnid: str
    year: int
    yield_t: float
    ndays: int
    peak_lai: float
    peak_lai_doy: int
    final_biomass: float
    total_et: float
    total_drainage: float
    min_soil_water: float
    max_soil_water: float
    mean_soil_water: float
    water_stress_days: int
    emergence_doy: Optional[int]
    senescence_doy: Optional[int]
    monthly_et: Dict[int, float] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return asdict(self)


# ==========================================================================
# Batch reporting -- produced by Nightshift (batch)
# ==========================================================================
@dataclass(frozen=True)
class StationYear:
    stnid: str
    year: int

    def __str__(self) -> str:
        return "%s/%d" % (self.stnid, self.year)


@dataclass
class RunOutcome:
    """Result of attempting one station-year in a batch: ok or failed."""
    target: StationYear
    ok: bool
    yield_t: Optional[float] = None
    ndays: Optional[int] = None
    dropped_days: int = 0
    elapsed_s: float = 0.0
    error: Optional[str] = None

    @classmethod
    def success(cls, target: StationYear, result: ForecastResult,
                elapsed_s: float) -> "RunOutcome":
        return cls(target=target, ok=True, yield_t=result.yield_t,
                   ndays=result.ndays, dropped_days=result.dropped_days,
                   elapsed_s=elapsed_s)

    @classmethod
    def failure(cls, target: StationYear, error: str,
                elapsed_s: float) -> "RunOutcome":
        return cls(target=target, ok=False, error=error, elapsed_s=elapsed_s)


@dataclass
class BatchReport:
    """Roll-up of a whole nightly batch.  Serial by construction (MRD-201)."""
    outcomes: List[RunOutcome] = field(default_factory=list)
    started_at: Optional[str] = None
    finished_at: Optional[str] = None

    def add(self, outcome: RunOutcome) -> None:
        self.outcomes.append(outcome)

    @property
    def total(self) -> int:
        return len(self.outcomes)

    @property
    def succeeded(self) -> int:
        return sum(1 for o in self.outcomes if o.ok)

    @property
    def failed(self) -> int:
        return sum(1 for o in self.outcomes if not o.ok)

    @property
    def total_elapsed_s(self) -> float:
        return sum(o.elapsed_s for o in self.outcomes)

    def failures(self) -> List[RunOutcome]:
        return [o for o in self.outcomes if not o.ok]

    def summary_line(self) -> str:
        return ("batch: %d run, %d ok, %d failed, %.1fs total"
                % (self.total, self.succeeded, self.failed,
                   self.total_elapsed_s))
