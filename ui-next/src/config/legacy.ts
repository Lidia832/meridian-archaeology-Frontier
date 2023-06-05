// src/config/legacy.ts
// J. Ferreira, 2023-08 — where each unmigrated screen lives in the OLD console.
//
// The legacy jQuery console (dashboard/) is a single page with hash-routed
// tabs. When a ui-next stub tells an operator "use the legacy console", it can
// send them to the exact tab rather than the console's front door. This maps
// ui-next routes to the legacy hash anchors that dashboard/js/dashboard.js
// wires up.
//
// If a route is not in this map, callers fall back to the bare console URL.

/** Base path the legacy console is served from (unchanged since 2016). */
export const LEGACY_CONSOLE_BASE = '/console';

/** ui-next route -> legacy console hash tab. */
export const LEGACY_ANCHORS: Record<string, string> = {
  '/anomalies': '#anomalies',
  '/compare': '#compare',
  '/quality': '#qa',
  '/ingest': '#collector',
  '/runs': '#batch',
  '/audit': '#audit',
  '/settings': '#prefs',
  '/about': '#about',
  // The three migrated screens intentionally have no entry here — you should be
  // using ui-next for those, not bouncing back to the old console.
};

/** Full deep link into the legacy console for a given ui-next route. */
export function legacyUrlFor(route: string): string {
  const anchor = LEGACY_ANCHORS[route];
  return anchor ? `${LEGACY_CONSOLE_BASE}${anchor}` : LEGACY_CONSOLE_BASE;
}
