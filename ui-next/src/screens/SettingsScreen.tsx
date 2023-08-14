// src/screens/SettingsScreen.tsx
// K. Duval, 2023-08 — STUB. The controls are rendered but wired to nothing.
//
// Settings was going to let operators set the API base, the health-poll
// interval and their preferred units without editing .env or index.html. The
// form below is the visual scaffold that got built in a spare afternoon; none
// of it persists anywhere. It is disabled on purpose so nobody mistakes it for
// a working screen.
//
// TODO(ui-next): back this with the react-query cache + localStorage once the
//   migration resumes. Until then, set VITE_API_BASE at build time. — K.D. 2023-08

import { PageHead } from '../components/PageHead';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { apiBase } from '../api/client';
import styles from '../components/StubScreen.module.css';

export function SettingsScreen() {
  useDocumentTitle('Settings (stub)');
  return (
    <>
      <PageHead title="Settings" crumb="not yet migrated · controls are inert" />

      <div className="banner warn">
        This screen is a stub. The controls below are shown for layout only and
        do not save. See MIGRATION.md (MRD-219).
      </div>

      <div className="panel" style={{ maxWidth: 560, opacity: 0.75 }}>
        <h3>Connection</h3>
        <div className="toolbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>API base URL</div>
            <input type="text" defaultValue={apiBase()} disabled style={{ width: '100%' }} />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Health poll interval</div>
            <select disabled defaultValue="15">
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
            </select>
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 4 }}>Yield units</div>
            <select disabled defaultValue="t_ha">
              <option value="t_ha">tonnes / ha</option>
              <option value="bu_ac">bushels / acre</option>
            </select>
          </label>
          <div>
            <button className="btn" disabled>Save (not wired)</button>
          </div>
        </div>

        <div className={styles.todo} style={{ marginTop: 16 }}>
          {`// TODO(ui-next): persist settings. Nothing here is connected.\n`}
          {`//   API base is read-only from VITE_API_BASE at build time.`}
        </div>
      </div>
    </>
  );
}
