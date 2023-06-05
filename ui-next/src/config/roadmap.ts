// src/config/roadmap.ts
// J. Ferreira, 2023-08 — the migration ledger, in code.
//
// This is the single source of truth for "which screens are done". The nav
// (src/config/nav.ts) reads it, the About/Settings stubs read it, and
// MIGRATION.md is kept in sync with it by hand. If you change a screen's
// status, change it HERE and then update MIGRATION.md to match.
//
// Status of the migration, as of the last commit before the team was pulled
// off (2023-09): 3 of 11 screens done. Nobody has owned this since.
//
//   MRD-219 (tracker): "The 2023 rewrite in ui-next/ covers 3 of 11 screens
//   and is stalled. Both consoles are deployed."

export type ScreenStatus = 'done' | 'stub' | 'not-started';

export interface RoadmapEntry {
  /** Route path segment. */
  path: string;
  /** Human label used in nav and headings. */
  label: string;
  status: ScreenStatus;
  /** The legacy screen this was meant to replace, if any. */
  legacy: string | null;
  /** Free note: why it is where it is. Shown on the stub pages. */
  note: string;
}

export const ROADMAP: RoadmapEntry[] = [
  {
    path: '/stations',
    label: 'Stations',
    status: 'done',
    legacy: 'dashboard #stations table',
    note: 'First screen migrated. Sortable/filterable, which the legacy grid was not.',
  },
  {
    path: '/forecast',
    label: 'Forecast',
    status: 'done',
    legacy: 'dashboard #forecast + #series + DOM bar chart',
    note: 'Second screen. Real SVG chart replaces the stopgap DOM bars (MRD-181).',
  },
  {
    path: '/health',
    label: 'Health',
    status: 'done',
    legacy: 'none — new in ui-next',
    note: 'Third screen. No legacy equivalent; added because the old console gave no signal when :8081 was down.',
  },
  {
    path: '/anomalies',
    label: 'Anomalies',
    status: 'stub',
    legacy: 'dashboard anomalies tab',
    note: 'Needs an /api/anomalies endpoint the service never grew. Scoped, not built.',
  },
  {
    path: '/compare',
    label: 'Compare',
    status: 'stub',
    legacy: 'dashboard compare view',
    note: 'Multi-station overlay. Depends on the chart work in Forecast being generalised first.',
  },
  {
    path: '/quality',
    label: 'Data Quality',
    status: 'stub',
    legacy: 'dashboard QA panel',
    note: 'Would surface gap/outlier flags. No owner since 2023-09.',
  },
  {
    path: '/ingest',
    label: 'Ingest Monitor',
    status: 'stub',
    legacy: 'dashboard collector status',
    note: 'Collector telemetry (ingest/). Blocked on an /api/ingest/status endpoint.',
  },
  {
    path: '/runs',
    label: 'Model Runs',
    status: 'stub',
    legacy: 'dashboard batch history',
    note: 'Nightly batch history (MRD-201). Needs /api/runs. Not started beyond this stub.',
  },
  {
    path: '/audit',
    label: 'Audit Log',
    status: 'stub',
    legacy: 'dashboard audit tab',
    note: 'Operator action log. Deferred pending an auth story that also never landed.',
  },
  {
    path: '/settings',
    label: 'Settings',
    status: 'stub',
    legacy: 'dashboard preferences',
    note: 'API base, refresh interval, units. Placeholder only.',
  },
  {
    path: '/about',
    label: 'About',
    status: 'stub',
    legacy: 'dashboard footer',
    note: 'Build info + migration status. Reads this roadmap. Intentionally the most honest page.',
  },
];

// ---- Derived counts. Keep MIGRATION.md's headline in sync with these. ----

export const TOTAL_SCREENS = ROADMAP.length; // 11
export const DONE_SCREENS = ROADMAP.filter((s) => s.status === 'done').length; // 3
export const STUB_SCREENS = ROADMAP.filter((s) => s.status === 'stub').length; // 8

/** e.g. "3 / 11" */
export const PROGRESS_LABEL = `${DONE_SCREENS} / ${TOTAL_SCREENS}`;

/** Hard-coded sanity check. If someone flips a status without meaning to, this
 *  trips in dev and reminds them MRD-219 is specifically "3 of 11". */
if (import.meta.env.DEV && DONE_SCREENS !== 3) {
  // eslint-disable-next-line no-console
  console.warn(
    `[ui-next] roadmap now reports ${DONE_SCREENS} done screens, not 3. ` +
      `MRD-219 describes a 3-of-11 stall; update MIGRATION.md if this was intentional.`,
  );
}

export const STALLED_SINCE = '2023-09';
export const STALL_REASON =
  'Team reassigned to the ingest backpressure incident (MRD-201 fallout); no owner assigned since. Migration parked at 3 of 11 screens.';
