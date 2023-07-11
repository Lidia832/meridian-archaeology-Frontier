// src/hooks/useForecast.ts
// A. Baht, 2023-07 — forecast runs for one station.

import { fetchForecast } from '../api/endpoints';
import type { ForecastRow } from '../api/types';
import { useAsync } from './useAsync';

/**
 * Load forecast runs for a station. `station` may be null while the user has
 * not chosen one yet; in that case the fetcher is disabled and stays idle.
 */
export function useForecast(station: string | null) {
  return useAsync<ForecastRow[]>(
    (signal) => fetchForecast(station as string, signal),
    [station],
    station != null && station.length > 0,
  );
}

/** The most recent run year in a set of forecast rows, or null. */
export function latestYear(rows: ForecastRow[] | null): number | null {
  if (!rows || rows.length === 0) return null;
  return rows.reduce((max, r) => (r.year > max ? r.year : max), rows[0].year);
}
