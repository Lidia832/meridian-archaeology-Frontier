// src/components/StatusBadge.tsx
// M. Osei, 2023-06 — the coloured status pill used by Health and the nav dot.

import type { HealthStatus } from '../hooks/useHealth';

const TONE: Record<HealthStatus, { cls: string; text: string }> = {
  ok: { cls: 'ok', text: 'Service OK' },
  degraded: { cls: 'warn', text: 'Degraded' },
  down: { cls: 'bad', text: 'Unreachable' },
  unknown: { cls: '', text: 'Checking…' },
};

interface StatusBadgeProps {
  status: HealthStatus;
  /** Override the label; otherwise a sensible default per status. */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const tone = TONE[status];
  return (
    <span className={`badge ${tone.cls}`} title={tone.text}>
      <span className="dot" />
      {label ?? tone.text}
    </span>
  );
}
