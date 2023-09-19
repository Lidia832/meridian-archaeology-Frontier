// src/components/StatTile.tsx
// M. Osei, 2023-08 — a small labelled value tile, for the Health header row.
//
// Just enough of a KPI tile to give the Health screen a scannable top strip
// (service state, version, migration progress) above the detail panels. Tone
// drives the accent colour; 'neutral' is the default.

import type { ReactNode } from 'react';
import { cx } from '../util/classnames';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad';

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}

export function StatTile({ label, value, hint, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={cx('stat-tile', tone !== 'neutral' && `tone-${tone}`)}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}
