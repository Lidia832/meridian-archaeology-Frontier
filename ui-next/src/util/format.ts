// src/util/format.ts
// M. Osei, 2023-07 — the number/date formatting the screens share.
//
// Pulled out of the screens once the third one started re-implementing
// toFixed() with the same rules. Not exhaustive — only what Stations, Forecast
// and Health actually needed. The stub screens would have added to this; they
// didn't, so it stops here.

/** Integer with thousands separators, e.g. 12045 -> "12,045". */
export function integer(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-CA');
}

/**
 * Fixed-decimal number that drops to an em dash for non-finite input. The
 * legacy console printed "NaN" straight into cells when the service hiccuped;
 * this is the small fix for that.
 */
export function fixed(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(dp);
}

/**
 * "Smart" precision used by the chart tooltip: more decimals for small numbers,
 * fewer for large ones, so biomass (thousands) and LAI (single digits) both
 * read cleanly.
 */
export function smart(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** Yield in t/ha with a fixed three decimals, matching the legacy console. */
export function yieldTonnes(n: number): string {
  return `${fixed(n, 3)} t/ha`;
}

/** Compact a run-count/record-count with a unit suffix. */
export function records(n: number): string {
  return `${integer(n)} rec`;
}

/** A year range, collapsing single-year ranges. 2011,2011 -> "2011". */
export function yearRange(first: number, last: number): string {
  if (first === last) return String(first);
  return `${first}–${last}`; // en dash
}

/**
 * Best-effort humanise of the service's run_at timestamp. The service emits it
 * as an opaque string and we deliberately do NOT parse it for display in the
 * table (we show it verbatim), but Health wanted a relative "x ago" so this
 * exists for that. Returns the original string if it will not parse.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const secs = Math.round((now.getTime() - t) / 1000);
  if (secs < 0) return iso;
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Clock time HH:MM:SS for the health "last checked" line. */
export function clock(d: Date): string {
  return d.toLocaleTimeString('en-CA', { hour12: false });
}
