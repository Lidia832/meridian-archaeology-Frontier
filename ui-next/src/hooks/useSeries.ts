// src/hooks/useSeries.ts
// A. Baht, 2023-07 — daily series for one station/year, plus chart-ready shaping.

import { useMemo } from 'react';
import { fetchSeries } from '../api/endpoints';
import type { SeriesRow, SeriesChannel } from '../api/types';
import { useAsync } from './useAsync';

export function useSeries(station: string | null, year: number | null) {
  return useAsync<SeriesRow[]>(
    (signal) => fetchSeries(station as string, year as number, signal),
    [station, year],
    station != null && station.length > 0 && year != null,
  );
}

export interface ChannelExtent {
  min: number;
  max: number;
}

/**
 * Compute per-channel extents once, so the chart and the table can share them
 * without each recomputing. The legacy console recomputed max biomass inline
 * every render (dashboard.js drawChart); this is the same idea, memoised and
 * for every channel rather than just biomass.
 */
export function useSeriesExtents(rows: SeriesRow[] | null) {
  return useMemo<Record<SeriesChannel, ChannelExtent>>(() => {
    const channels: SeriesChannel[] = ['sw', 'et', 'drain', 'biom', 'lai'];
    const out = {} as Record<SeriesChannel, ChannelExtent>;
    for (const ch of channels) {
      if (!rows || rows.length === 0) {
        out[ch] = { min: 0, max: 0 };
        continue;
      }
      let min = Infinity;
      let max = -Infinity;
      for (const r of rows) {
        const v = r[ch];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      out[ch] = { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
    }
    return out;
  }, [rows]);
}

/**
 * MRD-118 lives in the model, not here, but it is worth a defensive note: the
 * series is assumed to arrive in ascending DOY order. We do not re-sort — if a
 * deck came through out of order the chart would show it, which is arguably a
 * feature for anyone debugging the water balance. We only flag it.
 */
export function isDoyMonotonic(rows: SeriesRow[] | null): boolean {
  if (!rows || rows.length < 2) return true;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].doy < rows[i - 1].doy) return false;
  }
  return true;
}
