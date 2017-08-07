"""Enable `python -m reporting ...`.

Delegates straight to cli.main so the module form and any installed
console script behave identically.  Kept trivial on purpose; all the CLI
logic lives in cli.py where it can be imported and tested.
"""
from __future__ import annotations

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())
