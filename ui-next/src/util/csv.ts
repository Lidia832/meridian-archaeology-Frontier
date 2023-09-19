// src/util/csv.ts
// A. Baht, 2023-07 — CSV export.
//
// Operators asked for "the same download the old console had" — except the old
// console never actually had one; they were copy-pasting out of the HTML table.
// This is the real thing: turn the typed rows into RFC-4180-ish CSV and hand
// the browser a Blob to save. Used by the Forecast series table and the
// Stations table. Small, dependency-free, and one of the few net-new features
// the migration shipped before it stalled.

/** Quote a field if it contains a comma, quote, or newline (RFC 4180). */
function field(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV string from an array of objects. Columns are given explicitly as
 * [key, header] pairs so the header row reads nicely and column order is
 * stable regardless of object key order.
 */
export function toCsv<Row>(rows: Row[], columns: [keyof Row, string][]): string {
  const header = columns.map(([, h]) => field(h)).join(',');
  const body = rows
    .map((row) => columns.map(([k]) => field(row[k])).join(','))
    .join('\r\n');
  return body ? `${header}\r\n${body}` : header;
}

/**
 * Trigger a client-side download of `content` as `filename`. Uses an object URL
 * and a synthetic anchor click, revoking the URL on the next tick. No-op in a
 * non-browser context (guards the never-built SSR path).
 */
export function downloadText(filename: string, content: string, mime = 'text/csv'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Convenience: build CSV and download it in one call. */
export function downloadCsv<Row>(
  filename: string,
  rows: Row[],
  columns: [keyof Row, string][],
): void {
  downloadText(filename, toCsv(rows, columns));
}
