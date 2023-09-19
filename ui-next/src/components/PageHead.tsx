// src/components/PageHead.tsx
// M. Osei, 2023-06 — the heading strip every screen shares.

import type { ReactNode } from 'react';

interface PageHeadProps {
  title: string;
  crumb?: string;
  actions?: ReactNode;
}

export function PageHead({ title, crumb, actions }: PageHeadProps) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {crumb ? <div className="crumb">{crumb}</div> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
