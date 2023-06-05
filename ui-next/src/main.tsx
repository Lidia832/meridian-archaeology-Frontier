// src/main.tsx
// J. Ferreira, 2023-06 — application entry point.
//
// Boots React 18 with the concurrent createRoot API into #root (see index.html)
// and wraps the app in a BrowserRouter. StrictMode is on; the data hooks handle
// the double-invoke by cancelling in-flight requests through AbortController.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  // Should never happen — index.html ships the div. If it does, fail loudly
  // rather than silently rendering nothing (a lesson from the legacy console,
  // which failed silent).
  throw new Error('ui-next: #root element not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
