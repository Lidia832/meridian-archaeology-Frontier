"""Scratch-directory management for cropmod runs.

    -- Nightshift (orchestration) side --

cropmod reads MERIDIAN.DAT and writes MERIDIAN.OUT using those exact
names in its current working directory (MRD-201).  Two runs in the same
directory would clobber each other's files, so every run gets its own
scratch directory and, because the model binary is the shared resource,
runs are SERIALISED through a process-wide lock.  This is the single
largest constraint on the platform: the nightly batch of six stations
takes about four hours because it cannot fan out.  Do not "optimise"
this into a thread pool -- the files, not the CPU, are the bottleneck,
and parallel runs in separate dirs would still be safe only if the model
never used a fixed name, which it does.

M. Chen used a bare tempfile.mkdtemp inline in orchestrator.py; this
module (2022, newer maintainer) pulled it out so the lock, the cleanup
and the disk-space guard live in one place.
"""
from __future__ import annotations

import os
import shutil
import tempfile
import threading
from typing import Optional

from .config import Config
from .errors import ScratchError

# Process-wide serialisation lock.  Held for the lifetime of a ScratchRun
# context, i.e. across the whole deck-write / model-run / parse cycle for
# one station-year.  This is what enforces MRD-201: only one cropmod may
# be touching its fixed-name files at a time within a process.  It is a
# reentrant lock so a caller already inside a run can create a nested
# scratch (e.g. for a QC dry-run) without deadlocking.
_RUN_LOCK = threading.RLock()


def _min_free_bytes() -> int:
    # A cropmod deck+output for a full season is a few tens of KB; require
    # a comfortable margin so a full disk fails loudly here, not halfway
    # through the model writing its output.
    return 4 * 1024 * 1024


class ScratchDir:
    """A single scratch directory with tidy creation and cleanup.

    Usable as a context manager.  On exit the directory is removed unless
    ``keep`` is set, in which case its path is left on disk and logged by
    the caller for debugging.
    """

    def __init__(self, root: Optional[str] = None, prefix: str = "cropmod-",
                 keep: bool = False):
        self.root = root
        self.prefix = prefix
        self.keep = keep
        self.path: Optional[str] = None

    def create(self) -> str:
        if self.path is not None:
            raise ScratchError("scratch dir already created at %s" % self.path)
        if self.root is not None and not os.path.isdir(self.root):
            try:
                os.makedirs(self.root, exist_ok=True)
            except OSError as exc:
                raise ScratchError("cannot create scratch root %s: %s"
                                   % (self.root, exc))
        try:
            self.path = tempfile.mkdtemp(prefix=self.prefix, dir=self.root)
        except OSError as exc:
            raise ScratchError("cannot create scratch dir: %s" % exc)
        self._check_space(self.path)
        return self.path

    def _check_space(self, path: str) -> None:
        try:
            usage = shutil.disk_usage(path)
        except OSError:
            return  # non-fatal: some filesystems do not report usage
        if usage.free < _min_free_bytes():
            self.cleanup()
            raise ScratchError(
                "insufficient scratch space: %d bytes free, need %d"
                % (usage.free, _min_free_bytes()))

    def child(self, name: str) -> str:
        """Absolute path to ``name`` inside this scratch dir."""
        if self.path is None:
            raise ScratchError("scratch dir not created yet")
        return os.path.join(self.path, name)

    def cleanup(self) -> None:
        if self.path is None or self.keep:
            return
        shutil.rmtree(self.path, ignore_errors=True)
        self.path = None

    def __enter__(self) -> "ScratchDir":
        self.create()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.cleanup()


class ScratchRun:
    """A serialised scratch context for one cropmod invocation.

    Acquires the process-wide run lock on entry and releases it on exit,
    wrapping a ScratchDir.  This is the object the orchestrator uses so
    that "one run at a time" (MRD-201) is guaranteed structurally rather
    than by convention.
    """

    def __init__(self, config: Config):
        self.config = config
        self.dir = ScratchDir(root=config.scratch_root,
                              prefix=config.scratch_prefix,
                              keep=config.keep_scratch)
        self._locked = False

    @property
    def path(self) -> str:
        if self.dir.path is None:
            raise ScratchError("scratch run not active")
        return self.dir.path

    def child(self, name: str) -> str:
        return self.dir.child(name)

    def __enter__(self) -> "ScratchRun":
        _RUN_LOCK.acquire()
        self._locked = True
        try:
            self.dir.create()
        except Exception:
            _RUN_LOCK.release()
            self._locked = False
            raise
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            self.dir.cleanup()
        finally:
            if self._locked:
                _RUN_LOCK.release()
                self._locked = False


def run_lock() -> "threading.RLock":
    """Expose the serialisation lock (batch runner asserts it is serial)."""
    return _RUN_LOCK
