// src/components/StubScreen.tsx
// J. Ferreira, 2023-08 — the placeholder every unfinished screen renders.
//
// This is the honest heart of the "3 of 11" story. Each of the eight stub
// screens is a one-liner that hands its route to this component, which looks
// the route up in the roadmap ledger and prints exactly why it isn't done and
// where to go instead (the legacy console). No fake "coming soon" — the real
// status, from the real ledger.

import { PageHead } from './PageHead';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ROADMAP, STALLED_SINCE, STALL_REASON } from '../config/roadmap';
import { legacyUrlFor } from '../config/legacy';
import styles from './StubScreen.module.css';

interface StubScreenProps {
  /** Route path this stub stands in for, e.g. "/anomalies". */
  path: string;
}

export function StubScreen({ path }: StubScreenProps) {
  const entry = ROADMAP.find((r) => r.path === path);
  const label = entry?.label ?? path;
  const legacyUrl = legacyUrlFor(path);
  useDocumentTitle(`${label} (stub)`);

  return (
    <>
      <PageHead title={label} crumb="not yet migrated" />

      <div className={styles.wrap}>
        <span className={styles.tag}>Not yet migrated</span>
        <h3 className={styles.title}>{label} lives in the legacy console</h3>
        <p className={styles.lede}>
          This screen was scoped for the 2023 ui-next rewrite but never built.
          The migration stalled at three of eleven screens and has had no owner
          since {STALLED_SINCE}. Use the legacy operator console for this view.
        </p>

        <dl className={styles.meta}>
          <dt>Status</dt>
          <dd>stub — placeholder only</dd>
          <dt>Legacy equivalent</dt>
          <dd>{entry?.legacy ?? 'unknown'}</dd>
          <dt>Why parked</dt>
          <dd>{entry?.note ?? STALL_REASON}</dd>
        </dl>

        <div className={styles.legacyLink}>
          Open this in the legacy console:{' '}
          <a href={legacyUrl} target="_blank" rel="noreferrer">
            {legacyUrl}
          </a>{' '}
          <span className="muted">(jQuery console, dashboard/)</span>
        </div>

        {/* This block is deliberately visible in the UI, not just the source,
            so the stall is legible without opening a repo. */}
        <div className={styles.todo}>
          {`// TODO(ui-next): migrate ${label} from legacy dashboard\n`}
          {`//   ${entry?.note ?? ''}\n`}
          {`//   see MIGRATION.md · MRD-219 (3 of 11, stalled ${STALLED_SINCE})`}
        </div>
      </div>
    </>
  );
}
