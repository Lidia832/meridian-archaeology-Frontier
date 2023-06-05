// src/config/authors.ts
// J. Ferreira, 2023-09 — who worked on the rewrite, for the About footer.
//
// A small honesty measure: the migration had five people on it across 2023 and
// then nobody. Naming them (and the gap) on the About page is part of making
// the stall legible rather than mysterious to whoever inherits this.

export interface Contributor {
  initials: string;
  name: string;
  area: string;
}

export const CONTRIBUTORS: Contributor[] = [
  { initials: 'J.F.', name: 'J. Ferreira', area: 'lead, routing, screens' },
  { initials: 'A.B.', name: 'A. Baht', area: 'data hooks, API client' },
  { initials: 'M.O.', name: 'M. Osei', area: 'chart, styling, formatting' },
  { initials: 'K.D.', name: 'K. Duval', area: 'stubs, generic table' },
  { initials: 'P.S.', name: 'P. Sandoval', area: 'stubs, QA scoping' },
];

export const TEAM_LINE = CONTRIBUTORS.map((c) => c.name).join(', ');

/** The year the team was active, and the year it stopped. */
export const ACTIVE_FROM = 2023;
export const ACTIVE_TO = 2023;
