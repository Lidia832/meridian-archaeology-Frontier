// src/util/doy.test.ts
// A. Baht, 2023-08 — specs for the day-of-year helpers.
//
// Written for Vitest, which is not installed (see MIGRATION.md, debt item 4).
// Kept as an executable spec. DOY conversions are exactly the sort of thing
// that breaks silently in a leap year, so these were worth writing even though
// they have never run in CI (there is no CI).

import { describe, it, expect } from 'vitest';
import {
  isLeap,
  daysInYear,
  doyToDate,
  doyLabel,
  doyLabelFull,
  dateToDoy,
  monthTicks,
} from './doy';

describe('isLeap', () => {
  it('follows the Gregorian rule', () => {
    expect(isLeap(2020)).toBe(true);
    expect(isLeap(2021)).toBe(false);
    expect(isLeap(1900)).toBe(false); // divisible by 100, not 400
    expect(isLeap(2000)).toBe(true); // divisible by 400
  });
});

describe('daysInYear', () => {
  it('is 366 in a leap year and 365 otherwise', () => {
    expect(daysInYear(2020)).toBe(366);
    expect(daysInYear(2021)).toBe(365);
  });
});

describe('doyToDate', () => {
  it('maps DOY 1 to January 1', () => {
    const d = doyToDate(2021, 1);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
  it('maps DOY 60 to March 1 in a non-leap year', () => {
    const d = doyToDate(2021, 60);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
  });
  it('maps DOY 60 to Feb 29 in a leap year', () => {
    const d = doyToDate(2020, 60);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });
  it('clamps an out-of-range DOY to the year boundary', () => {
    const low = doyToDate(2021, 0);
    expect(low.getMonth()).toBe(0);
    expect(low.getDate()).toBe(1);
    const high = doyToDate(2021, 999);
    expect(high.getMonth()).toBe(11);
    expect(high.getDate()).toBe(31);
  });
});

describe('doyLabel / doyLabelFull', () => {
  it('renders a short date', () => {
    expect(doyLabel(2021, 1)).toBe('1 Jan');
    expect(doyLabel(2021, 60)).toBe('1 Mar');
  });
  it('renders a full date with year', () => {
    expect(doyLabelFull(2021, 60)).toBe('1 Mar 2021');
  });
});

describe('dateToDoy round-trips doyToDate', () => {
  it('is the identity for a sample of days', () => {
    for (const doy of [1, 45, 100, 200, 365]) {
      const back = dateToDoy(doyToDate(2021, doy));
      expect(back).toBe(doy);
    }
  });
});

describe('monthTicks', () => {
  it('returns twelve month starts, January first', () => {
    const ticks = monthTicks(2021);
    expect(ticks).toHaveLength(12);
    expect(ticks[0]).toEqual({ doy: 1, label: 'Jan' });
    expect(ticks[11].label).toBe('Dec');
  });
});
