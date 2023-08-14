// src/screens/AboutScreen.tsx
// J. Ferreira, 2023-09 — STUB (status), but the most honest page in the app.
//
// About is technically one of the eight unmigrated screens — the legacy console
// had a footer with build info and this was meant to replace it. What it grew
// into instead is the migration's own status page: it renders the roadmap
// ledger straight from roadmap.ts, so this page can never lie about how far the
// rewrite got. If you want to know the state of MRD-219, read this or read the
// ledger it is printed from; they are the same source.

import { PageHead } from '../components/PageHead';
import { StatusBadge } from '../components/StatusBadge';
import { useHealth } from '../hooks/useHealth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  ROADMAP,
  PROGRESS_LABEL,
  DONE_SCREENS,
  STUB_SCREENS,
  TOTAL_SCREENS,
  STALLED_SINCE,
  STALL_REASON,
} from '../config/roadmap';
import { CONTRIBUTORS, ACTIVE_FROM } from '../config/authors';

export function AboutScreen() {
  useDocumentTitle('About');
  const health = useHealth();

  return (
    <>
      <PageHead
        title="About"
        crumb="ui-next · migration status"
        actions={<StatusBadge status={health.status} />}
      />

      <div className="panel">
        <h3>Meridian operator console — ui-next</h3>
        <p style={{ marginTop: 0 }}>
          A 2023 React/Vite rewrite of the legacy operator console
          (<span className="mono">dashboard/</span>). Intended to replace all
          eleven screens; it replaced three before the work stalled. Both
          consoles are deployed and hit the same Java service on
          <span className="mono"> :8081</span>.
        </p>
        <dl className="kv">
          <dt>Progress</dt>
          <dd>
            {PROGRESS_LABEL} screens · {DONE_SCREENS} migrated, {STUB_SCREENS} stubbed
          </dd>
          <dt>Stalled since</dt>
          <dd>{STALLED_SINCE}</dd>
          <dt>Reason</dt>
          <dd style={{ fontFamily: 'inherit' }}>{STALL_REASON}</dd>
          <dt>Tracker</dt>
          <dd>MRD-219 (dashboard, major)</dd>
        </dl>
      </div>

      <div className="banner warn">
        This rewrite is incomplete and unowned. Do not decommission the legacy
        console at <span className="mono">/console</span> — {TOTAL_SCREENS - DONE_SCREENS} of{' '}
        {TOTAL_SCREENS} screens exist only there.
      </div>

      <div className="panel">
        <h3>Screen ledger</h3>
        <table className="grid">
          <thead>
            <tr>
              <th>Screen</th>
              <th>Status</th>
              <th>Legacy equivalent</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {ROADMAP.map((r) => (
              <tr key={r.path}>
                <td className="mono">{r.label}</td>
                <td>
                  {r.status === 'done' ? (
                    <span className="badge ok"><span className="dot" />done</span>
                  ) : (
                    <span className="badge warn"><span className="dot" />stub</span>
                  )}
                </td>
                <td className="muted" style={{ whiteSpace: 'normal' }}>{r.legacy ?? '—'}</td>
                <td className="muted" style={{ whiteSpace: 'normal', maxWidth: 320 }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Contributors ({ACTIVE_FROM})</h3>
        <table className="grid">
          <thead>
            <tr>
              <th>Who</th>
              <th>Area</th>
            </tr>
          </thead>
          <tbody>
            {CONTRIBUTORS.map((c) => (
              <tr key={c.initials}>
                <td className="mono">{c.name}</td>
                <td className="muted">{c.area}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          No contributors since {ACTIVE_FROM}. Build: Vite + React 18 + React
          Router. Chart: hand-rolled SVG (recharts was planned, never added —
          see MIGRATION.md).
        </p>
      </div>
    </>
  );
}
