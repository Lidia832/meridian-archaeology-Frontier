// src/api/client.ts
// J. Ferreira, 2023-06 — the fetch wrapper the three migrated screens share.
//
// This is the ui-next equivalent of dashboard/js/api.js. The old one was a
// jQuery.ajax closure with callbacks; this is fetch + typed promises. Same
// four endpoints, same base-URL story, minus the release-time sed.
//
// Deliberately small. There is no retry, no auth header, no request cancel
// beyond the AbortSignal that the hooks pass in. The service is internal and
// unauthenticated (see MRD-166 — SQL is built by string concatenation over
// there, which is exactly why this client never grew a query-builder: we do
// not want to make it easier to send clever strings to that layer).

const DEFAULT_BASE = 'http://localhost:8081';

/**
 * Resolve the API base URL.
 *
 * Priority:
 *   1. import.meta.env.VITE_API_BASE (set at build time, see .env.example)
 *   2. a window global, for the rare hand-deploy where someone edits index.html
 *   3. the localhost default
 *
 * The window-global escape hatch mirrors how the legacy console reads
 * window.MERIDIAN_API_BASE, so ops can keep one mental model across both.
 */
export function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE as string | undefined;
  if (fromEnv && fromEnv.length > 0) return stripTrailingSlash(fromEnv);
  const w = globalThis as unknown as { MERIDIAN_API_BASE?: string };
  if (w.MERIDIAN_API_BASE) return stripTrailingSlash(w.MERIDIAN_API_BASE);
  return DEFAULT_BASE;
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

/** Error type surfaced to hooks/components so they can distinguish causes. */
export class ApiError extends Error {
  readonly status: number | null;
  readonly url: string;
  constructor(message: string, url: string, status: number | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
}

interface QueryParams {
  [key: string]: string | number | undefined;
}

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(apiBase() + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Core GET. Returns parsed JSON typed as T.
 *
 * Throws ApiError on network failure, non-2xx, or a body that does not parse.
 * The service always answers JSON; if it does not, something is very wrong and
 * we would rather see the failure than a silent [].
 */
export async function getJson<T>(
  path: string,
  params?: QueryParams,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildUrl(path, params);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (err) {
    // Network-level failure (service down, CORS, DNS). The most common one in
    // practice is "the Java service isn't running", which is why the Health
    // screen exists — it makes that state a first-class thing operators can see.
    if (isAbort(err)) throw err;
    throw new ApiError(
      `Network error reaching ${url}. Is the Meridian service on :8081 up?`,
      url,
      null,
    );
  }

  if (!res.ok) {
    throw new ApiError(
      `Service returned HTTP ${res.status} for ${path}.`,
      url,
      res.status,
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(`Response from ${path} was not valid JSON.`, url, res.status);
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
