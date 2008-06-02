#!/usr/bin/env python3
"""Nightly forecast entry point.  Invoked from cron on the app host."""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from meridian.orchestrator import run_all, run_station_year
from meridian.store import Store


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="data/meridian.db")
    ap.add_argument("--station")
    ap.add_argument("--year", type=int)
    args = ap.parse_args()

    store = Store(args.db)
    try:
        if args.station and args.year:
            results = [run_station_year(store, args.station, args.year)]
        else:
            results = run_all(store)
        for r in results:
            print("%-10s %d  yield=%8.3f t/ha  days=%3d  rows=%3d  model=%s"
                  % (r["stnid"], r["year"], r["yield_t"], r["ndays"],
                     len(r["rows"]), r["model"]))
    finally:
        store.close()


if __name__ == "__main__":
    main()
