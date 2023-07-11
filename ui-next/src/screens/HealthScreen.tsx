// src/screens/HealthScreen.tsx
// A. Baht, 2023-07 — SCREEN 3 OF 3 (migrated). Health / diagnostics.
//
// This screen has NO legacy equivalent. The old console gave operators no
// signal when the Java service on :8081 was down — the tables just quietly
// went blank. Making service health a first-class, always-visible thing was
// one of the few clear wins of the migration, so it became the third screen.
//
// It polls /api/health (see useHealth), shows the reported version against the
// version this front-end was built to expect, and lists the resolved API base
// so an operator can confirm which service this console is pointed at.

import { PageHead } from '../components/PageHead';
import { StatusBadge } from '../components/StatusBadge';
import { StatTile, type Tone } from '../components/StatTile';
import { useHealth } from '../hooks/useHealth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { apiBase } from '../api/client';
import { clock } from '../util/format';
import { PROGRESS_LABEL, STALLED_SINCE, ROADMAP } from '../config/roadmap';

// The API version this build of the console was written and tested against.
// If the service reports something else, we flag a mismatch — it is usually the
// first sign that one half of the deploy moved and the other did not.
const EXPECTED_API_VERSION = '4.2.1';

export function HealthScreen() {
  useDocumentTitle('Health');
  const health = useHealth(15_000);

  const versionMismatch =
    health.version != null && health.version !== EXPECTED_API_VERSION;

  const doneCount = ROADMAP.filter((r) => r.status === 'done').length;

  const serviceTone: Tone =
    health.status === 'ok' ? 'ok' : health.status === 'down' ? 'bad' : 'warn';

  return (
    <>
      <PageHead
        title="Health & Diagnostics"
        crumb="ui-next · screen 3 of 3 migrated"
        actions={<StatusBadge status={health.status} />}
      />

      <div className="stat-row">
        <StatTile
          label="Service"
          value={health.status === 'ok' ? 'OK' : health.status === 'down' ? 'Down' : '—'}
          hint={health.lastChecked ? `checked ${clock(health.lastChecked)}` : 'checking…'}
          tone={serviceTone}
        />
        <StatTile
          label="API version"
          value={health.version ?? '—'}
          hint={versionMismatch ? `expected ${EXPECTED_API_VERSION}` : `expected ${EXPECTED_API_VERSION}`}
          tone={versionMismatch ? 'warn' : 'neutral'}
        />
        <StatTile
          label="Migration"
          value={PROGRESS_LABEL}
          hint={`${doneCount} screens migrated`}
          tone="warn"
        />
        <StatTile label="Legacy console" value="live" hint="/console" tone="neutral" />
      </div>

      <div className="row">
        <section className="panel grow">
          <h3>Service</h3>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <StatusBadge status={health.status} />
            </dd>
            <dt>Reported version</dt>
            <dd>{health.version ?? '—'}</dd>
            <dt>Expected version</dt>
            <dd>{EXPECTED_API_VERSION}</dd>
            <dt>Last checked</dt>
            <dd>{health.lastChecked ? clock(health.lastChecked) : '—'}</dd>
            <dt>API base</dt>
            <dd>{apiBase()}</dd>
          </dl>

          {versionMismatch ? (
            <div className="banner warn" style={{ marginTop: 12 }}>
              Service reports <span className="mono">{health.version}</span> but this
              console was built for <span className="mono">{EXPECTED_API_VERSION}</span>.
              One side of the deploy may be ahead of the other.
            </div>
          ) : null}

          {health.status === 'down' ? (
            <div className="banner error" style={{ marginTop: 12 }}>
              {health.error ?? 'The service is not answering.'} The legacy console
              at <span className="mono">/console</span> talks to the same service,
              so it is affected too — this is a service problem, not a ui-next one.
            </div>
          ) : null}

          {health.status === 'ok' ? (
            <div className="banner info" style={{ marginTop: 12 }}>
              Service is answering normally. Polling every 15s.
            </div>
          ) : null}
        </section>

        <section className="panel grow">
          <h3>Console (ui-next)</h3>
          <dl className="kv">
            <dt>Build mode</dt>
            <dd>{import.meta.env.DEV ? 'development' : 'production'}</dd>
            <dt>Migration</dt>
            <dd>
              {PROGRESS_LABEL} screens ({doneCount} done) · stalled {STALLED_SINCE}
            </dd>
            <dt>Tracker</dt>
            <dd>MRD-219</dd>
            <dt>Legacy console</dt>
            <dd>/console (still deployed)</dd>
          </dl>

          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Both consoles are live and hit the same service. If Health is green
            but a screen is blank, check whether that screen was ever migrated
            (see the nav — stub-tagged items live only in the legacy console).
          </p>
        </section>
      </div>

      <section className="panel">
        <h3>Endpoint reachability</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          The four endpoints this console depends on. Only <span className="mono">/api/health</span>{' '}
          is actively polled; the others are exercised by the Stations and
          Forecast screens on demand.
        </p>
        <table className="grid">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Used by</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">GET /api/health</td>
              <td>Health, nav badge</td>
              <td>
                <StatusBadge status={health.status} label={health.status === 'ok' ? 'reachable' : health.status === 'down' ? 'unreachable' : 'checking'} />
              </td>
            </tr>
            <tr>
              <td className="mono">GET /api/stations</td>
              <td>Stations, Forecast picker</td>
              <td className="muted">on demand</td>
            </tr>
            <tr>
              <td className="mono">GET /api/forecast</td>
              <td>Forecast</td>
              <td className="muted">on demand</td>
            </tr>
            <tr>
              <td className="mono">GET /api/series</td>
              <td>Forecast (chart)</td>
              <td className="muted">on demand</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
