#!/usr/bin/env python3
"""Synthetic telemetry frame generator.

Used to replay a season into the collector when a station drops out.
Kept in tools/ because it is not part of the deployed system.
"""
import argparse
import math
import random
import struct

MAGIC = 0x4D524431


def crc16(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def frame(stnid: str, year: int, doy: int, vals, flags: int = 0) -> bytes:
    body = struct.pack(">I", MAGIC)
    body += stnid.ljust(8)[:8].encode("ascii")
    body += struct.pack(">HH", year, doy)
    for v in vals:
        body += struct.pack(">i", int(round(v * 100)))
    body += struct.pack(">H", flags)
    return body + struct.pack(">H", crc16(body))


def season(stnid: str, year: int, seed: int):
    rng = random.Random(seed)
    out = []
    for doy in range(100, 274):
        phase = (doy - 100) / 173.0
        base = 8.0 + 18.0 * math.sin(math.pi * phase)
        tmax = base + 6.0 + rng.uniform(-3, 3)
        tmin = base - 4.0 + rng.uniform(-3, 3)
        rain = max(0.0, rng.gauss(2.1, 4.0)) if rng.random() < 0.32 else 0.0
        srad = max(2.0, 13.0 + 9.0 * math.sin(math.pi * phase) + rng.uniform(-4, 4))
        rh = min(100.0, max(20.0, rng.gauss(68, 12)))
        wind = max(0.0, rng.gauss(3.0, 1.4))
        flags = 1 if rng.random() < 0.01 else 0
        out.append(frame(stnid, year, doy, [tmax, tmin, rain, srad, rh, wind], flags))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("outfile")
    ap.add_argument("--year", type=int, default=2025)
    ap.add_argument("--stations", default="GUELPH,KITCHNER,WATERLOO,CAMBRIDG,MILTON,BRANTFRD")
    args = ap.parse_args()

    frames = []
    for i, stn in enumerate(args.stations.split(",")):
        frames.extend(season(stn.strip(), args.year, seed=1000 + i))

    with open(args.outfile, "wb") as fh:
        for f in frames:
            fh.write(f)
    print(f"wrote {len(frames)} frames to {args.outfile}")


if __name__ == "__main__":
    main()
