// src/util/format.test.ts
// M. Osei, 2023-08 — specs for the formatting helpers.
//
// NOTE: these are written for Vitest, which was never added to package.json.
// `npm test` does not run them (see MIGRATION.md, debt item 4). They are kept
// as an executable spec for whoever wires up the runner: `npm i -D vitest`,
// add a "test": "vitest" script, and these should pass as-is.

import { describe, it, expect } from 'vitest';
import {
  integer,
  fixed,
  smart,
  yieldTonnes,
  records,
  yearRange,
  timeAgo,
  clock,
} from './format';

describe('integer', () => {
  it('adds thousands separators', () => {
    expect(integer(12045)).toBe('12,045');
    expect(integer(7)).toBe('7');
  });
  it('rounds to whole numbers', () => {
    expect(integer(3.7)).toBe('4');
  });
  it('returns an em dash for non-finite input', () => {
    expect(integer(NaN)).toBe('—');
    expect(integer(Infinity)).toBe('—');
  });
});

describe('fixed', () => {
  it('honours the decimal-place argument', () => {
    expect(fixed(4.128, 3)).toBe('4.128');
    expect(fixed(4.128, 1)).toBe('4.1');
    expect(fixed(4, 0)).toBe('4');
  });
  it('defaults to two decimals', () => {
    expect(fixed(1.5)).toBe('1.50');
  });
  it('guards non-finite input rather than printing NaN', () => {
    expect(fixed(NaN)).toBe('—');
  });
});

describe('smart', () => {
  it('drops decimals for large magnitudes', () => {
    expect(smart(12000)).toBe('12000');
  });
  it('keeps one decimal in the tens-to-hundreds range', () => {
    expect(smart(42.37)).toBe('42.4');
  });
  it('keeps two decimals for small magnitudes', () => {
    expect(smart(5.678)).toBe('5.68');
  });
});

describe('yieldTonnes / records', () => {
  it('formats a yield with a unit', () => {
    expect(yieldTonnes(4.4021)).toBe('4.402 t/ha');
  });
  it('formats a record count with a unit', () => {
    expect(records(9132)).toBe('9,132 rec');
  });
});

describe('yearRange', () => {
  it('collapses a single-year range', () => {
    expect(yearRange(2011, 2011)).toBe('2011');
  });
  it('joins a multi-year range with an en dash', () => {
    expect(yearRange(1998, 2023)).toBe('1998–2023');
  });
});

describe('timeAgo', () => {
  const now = new Date('2023-10-03T05:00:00');
  it('reports seconds, minutes, hours, days', () => {
    expect(timeAgo('2023-10-03T04:59:30', now)).toBe('30s ago');
    expect(timeAgo('2023-10-03T04:30:00', now)).toBe('30m ago');
    expect(timeAgo('2023-10-03T02:00:00', now)).toBe('3h ago');
    expect(timeAgo('2023-10-01T05:00:00', now)).toBe('2d ago');
  });
  it('returns the original string for an unparseable timestamp', () => {
    expect(timeAgo('not-a-date', now)).toBe('not-a-date');
  });
  it('returns the original string for a future timestamp', () => {
    expect(timeAgo('2023-10-03T06:00:00', now)).toBe('2023-10-03T06:00:00');
  });
});

describe('clock', () => {
  it('formats 24-hour time', () => {
    const d = new Date('2023-10-03T14:05:09');
    // locale time is HH:MM:SS in en-CA 24h; assert the shape, not the tz.
    expect(clock(d)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
