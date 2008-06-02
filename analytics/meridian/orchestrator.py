"""Runs the numerical core for a station-year and stores the result.

    -- the one place the Nightshift/Archive seam is wired --

cropmod reads and writes files with fixed names in its current working
directory (MRD-201), so every run happens in a serialised scratch dir.
This is the single largest constraint on the whole platform and is why
the nightly batch takes four hours.

This module is where the two teams' code meets.  It does the Nightshift
work (assemble the spec, QC it, write the deck, run the model in a locked
scratch dir) and produces a ``RunArtifacts``.  It then hands that object
to the Archive side (parse -> summarise -> store) without either half
reaching into the other: Nightshift never parses output, Archive never
writes a deck.  The seam is the RunArtifacts object defined in results.py;
``run_station_year`` is the only function that touches both sides of it.

M. Chen's original inline mkdtemp/subprocess loop is now factored across
config.py, scratch.py, qc.py and deck.py; the flow it described is
unchanged.
"""
from __future__ import annotations

import datetime as _dt
import os
import subprocess
from typing import List, Optional

from . import aggregate, deck, parse, qc
from .config import Config, DEFAULT
from .errors import ModelRunError
from .results import ForecastResult, ModelInputSpec, RunArtifacts, SeasonSummary
from .scratch import ScratchRun
from .store import Store

# Kept for backward compatibility: callers/tests that predate Config read
# the model path from the environment exactly as before.
MODEL_BINARY = os.environ.get(
    "MERIDIAN_CROPMOD",
    os.path.join(os.path.dirname(__file__), "..", "..", "model", "cropmod"),
)
RUN_TIMEOUT_S = 120


def _resolve_binary(config: Config, stnid: str, year: int) -> str:
    binary = config.resolved_model_binary()
    if not os.path.exists(binary):
        raise ModelRunError("cropmod binary not found at %s" % binary,
                            stnid=stnid, year=year)
    return binary


# ==========================================================================
# NIGHTSHIFT (orchestration): spec -> RunArtifacts
# ==========================================================================
class NightshiftRun:
    """Context manager that runs cropmod once and exposes its artifacts.

    All of Nightshift's work lives in ``__enter__``: build the deck, run
    the model in a serialised scratch dir (MRD-201) and produce a
    ``RunArtifacts``.  The scratch dir is held open for the body of the
    ``with`` block so Archive can parse the output before it is cleaned
    up, then released on ``__exit__``.  This is what keeps the seam a
    clean handoff of one object rather than a shared temp path with a
    fragile lifetime.
    """

    def __init__(self, spec: ModelInputSpec, config: Config = DEFAULT):
        self.spec = spec
        self.config = config
        self._scratch: Optional[ScratchRun] = None
        self.artifacts: Optional[RunArtifacts] = None

    def __enter__(self) -> RunArtifacts:
        spec, config = self.spec, self.config
        binary = _resolve_binary(config, spec.stnid, spec.year)

        scratch = ScratchRun(config)
        scratch.__enter__()
        self._scratch = scratch
        try:
            deck_path = scratch.child(deck.DECK_NAME)
            n = deck.write_deck_spec(deck_path, spec)

            proc = subprocess.run(
                [binary], cwd=scratch.path, capture_output=True, text=True,
                timeout=config.run_timeout_s)
            if proc.returncode != 0:
                raise ModelRunError(
                    "cropmod exited %d: %s"
                    % (proc.returncode, proc.stderr.strip()[:200]),
                    stnid=spec.stnid, year=spec.year)

            out_path = scratch.child(parse.OUT_NAME)
            if not os.path.exists(out_path):
                raise ModelRunError("cropmod wrote no output file",
                                    stnid=spec.stnid, year=spec.year)

            self.artifacts = RunArtifacts(
                stnid=spec.stnid, year=spec.year, scratch_dir=scratch.path,
                deck_path=deck_path, out_path=out_path, model_binary=binary,
                returncode=proc.returncode, deck_days=n,
                stdout_tail=proc.stdout.strip()[-200:])
            return self.artifacts
        except Exception:
            scratch.__exit__(None, None, None)
            self._scratch = None
            raise

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._scratch is not None:
            self._scratch.__exit__(exc_type, exc, tb)
            self._scratch = None


def build_spec(store: Store, stnid: str, year: int) -> ModelInputSpec:
    """Assemble the model input spec from the store (hard-coded soil, MRD-91)."""
    readings = store.readings(stnid, year)
    if not readings:
        raise ModelRunError("no readings for %s %d" % (stnid, year),
                            stnid=stnid, year=year)
    return deck.spec_from_readings(stnid, year, readings)


# ==========================================================================
# SEAM WIRING: RunArtifacts -> (Archive) -> stored ForecastResult
# ==========================================================================
def _absorb(store: Store, artifacts: RunArtifacts, run_at: str):
    """Archive side of the seam: parse -> summarise -> persist.

    Takes nothing but the RunArtifacts (and the store to write into).  It
    is the mirror of NightshiftRun: everything here is Archive code, and
    it never looks at decks, scratch dirs or the model binary.
    """
    result: ForecastResult = parse.parse_artifacts(artifacts, run_at=run_at)
    summary: SeasonSummary = aggregate.summarize_result(result)
    store.save_result(result, run_at=run_at)
    return result, summary


def run_station_year(store: Store, stnid: str, year: int,
                     config: Optional[Config] = None,
                     keep_scratch: bool = False):
    """Full pipeline for one station-year, across the seam.

    Returns the legacy result dict so run_forecast.py and older callers
    keep working; the typed ForecastResult and SeasonSummary are attached
    under 'result' and 'summary' keys for newer callers.
    """
    if config is None:
        config = Config(keep_scratch=True) if keep_scratch else DEFAULT

    # ---- NIGHTSHIFT ----------------------------------------------------
    spec = build_spec(store, stnid, year)
    if config.qc_enabled:
        qc.check_inputs(spec, config.qc, blocking=config.qc_blocking)

    with NightshiftRun(spec, config) as artifacts:
        # ==== SEAM: hand RunArtifacts to Archive ========================
        run_at = _dt.datetime.now().isoformat(timespec="seconds")
        result, summary = _absorb(store, artifacts, run_at)
        # ================================================================
        deck_days = artifacts.deck_days

    legacy = result.as_legacy_dict()
    legacy["deck_days"] = deck_days
    legacy["run_at"] = run_at
    legacy["result"] = result
    legacy["summary"] = summary
    legacy["dropped_days"] = result.dropped_days
    return legacy


def run_all(store: Store, config: Optional[Config] = None) -> List[dict]:
    """Serial run over every station-year in the store (MRD-201).

    Preserved from M. Chen's version; the nightly batch (batch.py) is the
    richer runner, but run_all stays as the simple "do everything" call.
    Runs are serial by construction: NightshiftRun holds the run lock, so
    even if a caller threaded this it could not parallelise the model.
    """
    out = []
    for stn in store.stations():
        for yr in store.years(stn):
            out.append(run_station_year(store, stn, yr, config=config))
    return out
