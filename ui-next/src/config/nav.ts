// src/config/nav.ts
// J. Ferreira, 2023-08 — the nav model. Derived from the roadmap so the sidebar
// can never disagree with MIGRATION.md about what is done.
//
// All 11 screens appear in the nav. The eight unfinished ones are deliberately
// left visible (not hidden behind a feature flag) so that operators — and the
// next team, whenever that is — can see the shape of the intended console and
// exactly how far it got. A hidden stub is a lie; a labelled one is a map.

import { ROADMAP, type RoadmapEntry } from './roadmap';

export interface NavItem {
  path: string;
  label: string;
  done: boolean;
  /** Short glyph used in the sidebar. Plain text so no icon dependency. */
  glyph: string;
}

const GLYPHS: Record<string, string> = {
  '/stations': '▤',
  '/forecast': '◈',
  '/health': '❤',
  '/anomalies': '⚠',
  '/compare': '⇄',
  '/quality': '✓',
  '/ingest': '↧',
  '/runs': '⟳',
  '/audit': '☰',
  '/settings': '⚙',
  '/about': 'ⓘ',
};

export const NAV_ITEMS: NavItem[] = ROADMAP.map((entry: RoadmapEntry) => ({
  path: entry.path,
  label: entry.label,
  done: entry.status === 'done',
  glyph: GLYPHS[entry.path] ?? '·',
}));

/** The default landing route. Stations is the natural entry point and is one of
 *  the three that actually works. */
export const DEFAULT_ROUTE = '/stations';
