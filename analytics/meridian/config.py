"""Runtime configuration for the analytics subsystem.

Historically every knob was an ``os.environ.get`` scattered through
orchestrator.py.  That worked until the batch runner needed the same
values and they drifted.  This module (2021, newer maintainer) pulls
them into one immutable object built once at start-up.

Both halves read from the same Config, but they read disjoint parts of
it: Nightshift uses the model/scratch/qc knobs, Archive uses the store
knobs.  Nothing here does I/O; ``from_env`` only reads the environment.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field, replace
from typing import Dict, Mapping, Optional

from .errors import ConfigError


def _default_model_binary() -> str:
    return os.path.join(
        os.path.dirname(__file__), "..", "..", "model", "cropmod")


@dataclass(frozen=True)
class QCLimits:
    """Physical bounds used by qc.py to sanity-check input weather.

    These are generous envelopes for southern Ontario stations, not
    agronomic targets: the point is to catch a decoding error or a stuck
    sensor before it reaches the model, not to second-guess the weather.
    """
    tmax_min: float = -45.0
    tmax_max: float = 45.0
    tmin_min: float = -50.0
    tmin_max: float = 35.0
    rain_min: float = 0.0
    rain_max: float = 250.0
    srad_min: float = 0.0
    srad_max: float = 40.0
    # A season with fewer than this many days is too short to bother the
    # model with; QC blocks it rather than producing a meaningless yield.
    min_days: int = 30
    # Above this many missing interior days the season is too gappy to
    # trust.  cropmod does not interpolate.
    max_interior_gap_days: int = 20

    def validate(self) -> None:
        if self.tmax_min >= self.tmax_max:
            raise ConfigError("QCLimits: tmax_min must be below tmax_max")
        if self.tmin_min >= self.tmin_max:
            raise ConfigError("QCLimits: tmin_min must be below tmin_max")
        if self.rain_max <= self.rain_min:
            raise ConfigError("QCLimits: rain_max must exceed rain_min")
        if self.srad_max <= self.srad_min:
            raise ConfigError("QCLimits: srad_max must exceed srad_min")
        if self.min_days < 1:
            raise ConfigError("QCLimits: min_days must be positive")


@dataclass(frozen=True)
class Config:
    """The one configuration object the subsystem is built from.

    Attributes
    ----------
    model_binary:
        Path to the compiled cropmod executable.
    run_timeout_s:
        Wall-clock budget for a single cropmod invocation.
    scratch_root:
        Parent directory scratch dirs are created under.  ``None`` means
        the system temp dir.
    keep_scratch:
        Leave scratch dirs on disk after a run (debugging).
    db_path:
        SQLite store the collector writes and Archive reads/writes.
    qc_enabled / qc_blocking:
        Whether input QC runs, and whether a QC failure aborts the run
        (blocking) or is merely recorded (advisory).
    qc:
        Physical limits, see :class:`QCLimits`.
    stop_on_error:
        Batch policy: stop the whole nightly run on the first failure, or
        record it and carry on.  Default is to carry on -- a single bad
        station should not cost the other five their forecast.
    """
    model_binary: str = field(default_factory=_default_model_binary)
    run_timeout_s: int = 120
    scratch_root: Optional[str] = None
    scratch_prefix: str = "cropmod-"
    keep_scratch: bool = False
    db_path: str = "data/meridian.db"
    qc_enabled: bool = True
    qc_blocking: bool = True
    qc: QCLimits = field(default_factory=QCLimits)
    stop_on_error: bool = False

    def __post_init__(self):
        self.validate()

    def validate(self) -> None:
        if not self.model_binary:
            raise ConfigError("model_binary must be set")
        if self.run_timeout_s <= 0:
            raise ConfigError("run_timeout_s must be positive")
        if not self.scratch_prefix:
            raise ConfigError("scratch_prefix must be non-empty")
        self.qc.validate()

    def resolved_model_binary(self) -> str:
        """Absolute path to the model binary, resolved from cwd."""
        return os.path.abspath(self.model_binary)

    def with_db(self, db_path: str) -> "Config":
        return replace(self, db_path=db_path)

    def with_scratch_root(self, root: Optional[str]) -> "Config":
        return replace(self, scratch_root=root)

    # -- construction ------------------------------------------------------
    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None) -> "Config":
        """Build a Config from environment variables.

        Recognised: MERIDIAN_CROPMOD, MERIDIAN_DB, MERIDIAN_SCRATCH_ROOT,
        MERIDIAN_RUN_TIMEOUT_S, MERIDIAN_KEEP_SCRATCH, MERIDIAN_QC,
        MERIDIAN_QC_BLOCKING, MERIDIAN_STOP_ON_ERROR.  Anything unset
        falls through to the dataclass default.
        """
        env = os.environ if env is None else env
        kwargs: Dict[str, object] = {}
        if env.get("MERIDIAN_CROPMOD"):
            kwargs["model_binary"] = env["MERIDIAN_CROPMOD"]
        if env.get("MERIDIAN_DB"):
            kwargs["db_path"] = env["MERIDIAN_DB"]
        if env.get("MERIDIAN_SCRATCH_ROOT"):
            kwargs["scratch_root"] = env["MERIDIAN_SCRATCH_ROOT"]
        if env.get("MERIDIAN_RUN_TIMEOUT_S"):
            kwargs["run_timeout_s"] = _int(env["MERIDIAN_RUN_TIMEOUT_S"],
                                           "MERIDIAN_RUN_TIMEOUT_S")
        if env.get("MERIDIAN_KEEP_SCRATCH"):
            kwargs["keep_scratch"] = _bool(env["MERIDIAN_KEEP_SCRATCH"])
        if env.get("MERIDIAN_QC"):
            kwargs["qc_enabled"] = _bool(env["MERIDIAN_QC"])
        if env.get("MERIDIAN_QC_BLOCKING"):
            kwargs["qc_blocking"] = _bool(env["MERIDIAN_QC_BLOCKING"])
        if env.get("MERIDIAN_STOP_ON_ERROR"):
            kwargs["stop_on_error"] = _bool(env["MERIDIAN_STOP_ON_ERROR"])
        return cls(**kwargs)

    @classmethod
    def from_dict(cls, data: Mapping[str, object]) -> "Config":
        """Build a Config from a plain mapping, ignoring unknown keys."""
        known = {f for f in cls.__dataclass_fields__ if f != "qc"}
        kwargs = {k: v for k, v in data.items() if k in known}
        qc = data.get("qc")
        if isinstance(qc, QCLimits):
            kwargs["qc"] = qc
        elif isinstance(qc, Mapping):
            fields = QCLimits.__dataclass_fields__
            kwargs["qc"] = QCLimits(
                **{k: v for k, v in qc.items() if k in fields})
        return cls(**kwargs)


def _bool(value: str) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on", "y")


def _int(value: str, name: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ConfigError("%s must be an integer, got %r" % (name, value))


DEFAULT = Config()
