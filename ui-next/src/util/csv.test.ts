// src/util/csv.test.ts
// A. Baht, 2023-08 — specs for the CSV builder.
//
// Written for Vitest, which is not installed (see MIGRATION.md, debt item 4).
// downloadText/downloadCsv are DOM side-effects and are not covered here; only
// the pure toCsv() is, which is where the RFC-4180 quoting logic lives.

import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

interface Row {
  stnid: string;
  days: number;
  note: string;
}

const cols: [keyof Row, string][] = [
  ['stnid', 'Station'],
  ['days', 'Records'],
  ['note', 'Note'],
];

describe('toCsv', () => {
  it('emits a header row even with no data', () => {
    expect(toCsv<Row>([], cols)).toBe('Station,Records,Note');
  });

  it('emits header + rows with CRLF line endings', () => {
    const rows: Row[] = [
      { stnid: 'AB-EDM-01', days: 9132, note: 'ok' },
      { stnid: 'SK-RGN-02', days: 10233, note: 'ok' },
    ];
    expect(toCsv(rows, cols)).toBe(
      'Station,Records,Note\r\nAB-EDM-01,9132,ok\r\nSK-RGN-02,10233,ok',
    );
  });

  it('quotes fields containing a comma', () => {
    const rows: Row[] = [{ stnid: 'X', days: 1, note: 'a, b' }];
    expect(toCsv(rows, cols)).toContain('"a, b"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const rows: Row[] = [{ stnid: 'X', days: 1, note: 'say "hi"' }];
    expect(toCsv(rows, cols)).toContain('"say ""hi"""');
  });

  it('quotes fields containing a newline', () => {
    const rows: Row[] = [{ stnid: 'X', days: 1, note: 'line1\nline2' }];
    expect(toCsv(rows, cols)).toContain('"line1\nline2"');
  });

  it('renders null/undefined as an empty field', () => {
    const rows = [{ stnid: 'X', days: 1, note: undefined }] as unknown as Row[];
    expect(toCsv(rows, cols)).toBe('Station,Records,Note\r\nX,1,');
  });
});
