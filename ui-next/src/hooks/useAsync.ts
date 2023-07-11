// src/hooks/useAsync.ts
// A. Baht, 2023-06 — the one data-fetching primitive every real screen uses.
//
// We evaluated pulling in @tanstack/react-query for this (it would have given
// us caching, retries and devtools for free). It was on the roadmap for the
// "get past three screens" push that never happened, so instead we have this:
// a hand-rolled request-state hook. It is enough for three screens and it has
// no dependencies, which given how the migration went turned out to be lucky.
//
// TODO(ui-next): replace with react-query once the migration resumes. The
// stub screens assume a cache exists; they will need one. — A.B. 2023-07

import { useEffect, useRef, useState, useCallback } from 'react';
import { ApiError } from '../api/client';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: ApiError | Error | null;
  /** True on the very first load only; false on subsequent refetches. */
  firstLoad: boolean;
  /** Re-run the fetcher. Safe to call from an onClick. */
  reload: () => void;
}

/**
 * Run an async fetcher and track its state, cancelling in-flight requests on
 * unmount or when `deps` change. The fetcher receives an AbortSignal.
 *
 * @param fetcher  produces the promise; recreated when deps change
 * @param deps     dependency list — when these change we refetch
 * @param enabled  when false the fetcher is not run (used by screens that must
 *                 wait for a selection before they can query)
 */
export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>,
  enabled = true,
): AsyncState<T> {
  const [status, setStatus] = useState<AsyncStatus>(enabled ? 'loading' : 'idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const firstLoadRef = useRef(true);
  const [firstLoad, setFirstLoad] = useState(true);
  // Bumping this forces the effect to re-run without changing the real deps.
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    let cancelled = false;

    setStatus('loading');
    setError(null);

    fetcher(controller.signal)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Aborts are expected on unmount/dep-change; do not surface them.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
      })
      .finally(() => {
        if (cancelled) return;
        if (firstLoadRef.current) {
          firstLoadRef.current = false;
          setFirstLoad(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  return { status, data, error, firstLoad, reload };
}
