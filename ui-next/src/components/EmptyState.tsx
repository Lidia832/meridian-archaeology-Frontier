// src/components/EmptyState.tsx
// M. Osei, 2023-06 — the "there is nothing here, and that's fine" state.

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  detail?: ReactNode;
}

export function EmptyState({ title, detail }: EmptyStateProps) {
  return (
    <div className="empty">
      <div style={{ fontSize: 15, marginBottom: 4 }}>{title}</div>
      {detail ? <div className="muted" style={{ fontSize: 13 }}>{detail}</div> : null}
    </div>
  );
}
