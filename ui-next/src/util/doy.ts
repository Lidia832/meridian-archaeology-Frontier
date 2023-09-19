// src/util/doy.ts
// A. Baht, 2023-07 — day-of-year helpers.
//
// The series is indexed by day-of-year (DOY), 1..365/366, the way the Fortran
// model has always emitted it. Operators think in calendar dates, so the chart
// and tables can translate. DOY 1 is Jan 1. We do NOT know the calendar year of
// a series from the /api/series rows themselves — the caller passes it in from
// the forecast run — so every function here takes the year explicitly.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Whether a Gregorian year is a leap year. */
export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in the given year (365 or 366). */
export function daysInYear(year: number): number {
  return isLeap(year) ? 366 : 365;
}

/**
 * Convert a day-of-year to a JS Date at local midnight. DOY is clamped into
 * range rather than rolling over, because an out-of-range DOY here means bad
 * data upstream (MRD-118 territory) and we would rather show it pinned at the
 * boundary than silently land it in the next year.
 */
export function doyToDate(year: number, doy: number): Date {
  const max = daysInYear(year);
  const clamped = Math.min(Math.max(Math.round(doy), 1), max);
  const d = new Date(year, 0, 1);
  d.setDate(clamped);
  return d;
}

/** "12 May" style label for a DOY within a year. */
export function doyLabel(year: number, doy: number): string {
  const d = doyToDate(year, doy);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "12 May 2011" style label. */
export function doyLabelFull(year: number, doy: number): string {
  return `${doyLabel(year, doy)} ${year}`;
}

/**
 * The DOY at the first of each month, for axis ticks that fall on month
 * boundaries rather than arbitrary day numbers. Returns [{doy, label}].
 */
export function monthTicks(year: number): { doy: number; label: string }[] {
  const out: { doy: number; label: string }[] = [];
  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1);
    const doy = dateToDoy(first);
    out.push({ doy, label: MONTHS[m] });
  }
  return out;
}

/** Inverse of doyToDate: the 1-based day-of-year for a Date. */
export function dateToDoy(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000) + 1;
}
