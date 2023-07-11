// src/hooks/useInterval.ts
// A. Baht, 2023-07 — the declarative setInterval (the "Dan Abramov" pattern).
//
// Written for the Ingest Monitor screen, which was going to poll collector
// status on a tick. That screen is a stub, so right now this hook has no
// caller — it is kept because the moment the migration resumes, Ingest Monitor
// and Model Runs both need exactly this. Deleting it would just mean rewriting
// it. Left with a note rather than removed.
//
// TODO(ui-next): first real caller is the Ingest Monitor screen. — A.B. 2023-08

import { useEffect, useRef } from 'react';

/**
 * Call `callback` every `delayMs`. Passing `null` for the delay pauses the
 * interval without tearing down the component. The callback is kept in a ref so
 * that changing it does not reset the timer.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => saved.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
