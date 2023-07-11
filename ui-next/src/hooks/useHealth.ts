// src/hooks/useHealth.ts
// A. Baht, 2023-06 — health poll used by the Health screen and the nav badge.

import { useEffect, useState } from 'react';
import { fetchHealth } from '../api/endpoints';
import type { HealthResponse } from '../api/types';
import { ApiError } from '../api/client';

export type HealthStatus = 'unknown' | 'ok' | 'degraded' | 'down';

export interface HealthState {
  status: HealthStatus;
  version: string | null;
  /** When the last successful poll landed. */
  lastChecked: Date | null;
  error: string | null;
}

/**
 * Poll /api/health on an interval. Used in two places:
 *   - the Health/Diagnostics screen (full detail)
 *   - the nav sidebar badge (status dot only)
 *
 * Default interval is 30s. The legacy console never polled health at all —
 * operators found out the service was down by watching the stations table go
 * blank. Surfacing it was one of the small wins of the migration.
 */
export function useHealth(intervalMs = 30_000): HealthState {
  const [state, setState] = useState<HealthState>({
    status: 'unknown',
    version: null,
    lastChecked: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const controller = new AbortController();
      try {
        const res: HealthResponse = await fetchHealth(controller.signal);
        if (cancelled) return;
        setState({
          status: res.status === 'ok' ? 'ok' : 'degraded',
          version: res.version ?? null,
          lastChecked: new Date(),
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : 'Health check failed.';
        setState((prev) => ({
          status: 'down',
          version: prev.version, // keep the last known version for context
          lastChecked: prev.lastChecked,
          error: msg,
        }));
      } finally {
        if (!cancelled) timer = setTimeout(poll, intervalMs);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return state;
}
