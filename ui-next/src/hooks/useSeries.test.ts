// src/hooks/useSeries.test.ts
// A. Baht, 2023-08 — spec for the pure helper isDoyMonotonic.
//
// Written for Vitest, which is not installed (see MIGRATION.md, debt item 4).
// The hooks themselves need @testing-library/react to exercise; that was also
// never added. Only the pure ordering check is covered here — it is the one
// that matters for MRD-118 (out-of-order decks give silently wrong results).

import { describe, it, expect } from 'vitest';
import { isDoyMonotonic } from './useSeries';
import type { SeriesRow } from '../api/types';

function row(doy: number): SeriesRow {
  return { doy, sw: 0, et: 0, drain: 0, biom: 0, lai: 0 };
}

describe('isDoyMonotonic', () => {
  it('treats null / empty / single-row as trivially ordered', () => {
    expect(isDoyMonotonic(null)).toBe(true);
    expect(isDoyMonotonic([])).toBe(true);
    expect(isDoyMonotonic([row(42)])).toBe(true);
  });

  it('accepts a strictly ascending series', () => {
    expect(isDoyMonotonic([row(1), row(2), row(3), row(100)])).toBe(true);
  });

  it('accepts equal-adjacent DOYs (non-decreasing counts as ordered)', () => {
    expect(isDoyMonotonic([row(1), row(1), row(2)])).toBe(true);
  });

  it('rejects a series that steps backwards', () => {
    expect(isDoyMonotonic([row(1), row(5), row(4), row(6)])).toBe(false);
  });

  it('flags the MRD-118 case: a single out-of-order day', () => {
    const season = [row(110), row(111), row(113), row(112), row(114)];
    expect(isDoyMonotonic(season)).toBe(false);
  });
});
