// src/components/Layout.tsx
// J. Ferreira, 2023-08 — the app shell: sidebar + routed content pane.

import { Outlet } from 'react-router-dom';
import { NavSidebar } from './NavSidebar';
import { ErrorBoundary } from './ErrorBoundary';

export function Layout() {
  return (
    <div className="app">
      <NavSidebar />
      <main className="main">
        {/* One boundary around the routed content. A crash in a screen shows a
            recoverable panel instead of blanking the whole console. */}
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
