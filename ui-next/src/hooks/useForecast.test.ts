// src/hooks/useForecast.test.ts
// A. Baht, 2023-08 — spec for the pure helper latestYear.
// Vitest not installed; see MIGRATION.md.

import { describe, it, expect } from 'vitest';
import { latestYear } from './useForecast';
import type { ForecastRow } from '../api/types';

function run(year: number): ForecastRow {
  return {
    stnid: 'AB-EDM-01',
    year,
    yield_t: 4,
    ndays: 180,
    model: 'cropmod-1.4',
    run_at: `${year}-10-01T04:00:00`,
  };
}

describe('latestYear', () => {
  it('returns null for null or empty input', () => {
    expect(latestYear(null)).toBeNull();
    expect(latestYear([])).toBeNull();
  });

  it('returns the only year for a single run', () => {
    expect(latestYear([run(2022)])).toBe(2022);
  });

  it('returns the maximum year regardless of order', () => {
    expect(latestYear([run(2021), run(2023), run(2022)])).toBe(2023);
    expect(latestYear([run(2023), run(2019)])).toBe(2023);
  });
});
