// src/config/roadmap.test.ts
// J. Ferreira, 2023-08 — the test that guards MRD-219 itself.
//
// Written for Vitest, which is not installed (see MIGRATION.md, debt item 4).
// This one is here on purpose: if someone flips a screen's status without
// meaning to, this spec is where it should get caught. The invariant IS the
// defect the tracker describes — three of eleven, stalled.

import { describe, it, expect } from 'vitest';
import {
  ROADMAP,
  TOTAL_SCREENS,
  DONE_SCREENS,
  STUB_SCREENS,
  PROGRESS_LABEL,
} from './roadmap';

describe('MRD-219 invariant', () => {
  it('has eleven screens in total', () => {
    expect(TOTAL_SCREENS).toBe(11);
    expect(ROADMAP).toHaveLength(11);
  });

  it('has exactly three migrated screens', () => {
    expect(DONE_SCREENS).toBe(3);
    const done = ROADMAP.filter((r) => r.status === 'done').map((r) => r.path);
    expect(done.sort()).toEqual(['/forecast', '/health', '/stations']);
  });

  it('has exactly eight stubbed screens', () => {
    expect(STUB_SCREENS).toBe(8);
  });

  it('accounts for every screen (done + stub === total)', () => {
    expect(DONE_SCREENS + STUB_SCREENS).toBe(TOTAL_SCREENS);
  });

  it('renders the progress label the nav shows', () => {
    expect(PROGRESS_LABEL).toBe('3 / 11');
  });

  it('gives every screen a unique route and a note', () => {
    const paths = new Set(ROADMAP.map((r) => r.path));
    expect(paths.size).toBe(ROADMAP.length);
    for (const r of ROADMAP) {
      expect(r.note.length).toBeGreaterThan(0);
    }
  });
});
