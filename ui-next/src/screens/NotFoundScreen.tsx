// src/screens/NotFoundScreen.tsx
// J. Ferreira, 2023-06 — unknown route. Nudges toward the legacy console, since
// a "missing" screen here is very often one that was simply never migrated.

import { Link, useLocation } from 'react-router-dom';
import { PageHead } from '../components/PageHead';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { DEFAULT_ROUTE } from '../config/nav';

export function NotFoundScreen() {
  useDocumentTitle('Not found');
  const loc = useLocation();
  return (
    <>
      <PageHead title="Not found" />
      <div className="panel">
        <p>
          No ui-next screen is mounted at <span className="mono">{loc.pathname}</span>.
        </p>
        <p className="muted">
          If you were looking for a screen that used to be in the old console, it
          may never have been migrated (only 3 of 11 were). Try the legacy console
          at <span className="mono">/console</span>, or go back to{' '}
          <Link to={DEFAULT_ROUTE}>Stations</Link>.
        </p>
      </div>
    </>
  );
}
