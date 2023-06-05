// src/api/client.test.ts
// A. Baht, 2023-08 — specs for the API client's URL/error behaviour.
//
// Written for Vitest, which is not installed (see MIGRATION.md, debt item 4).
// The fetch paths (network error -> ApiError, non-2xx -> ApiError, bad JSON ->
// ApiError) would need fetch mocked; sketched at the bottom as `it.todo` so the
// intent survives. What is covered here is the pure base-URL resolution, which
// is the part that has actually bitten us in deploys.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiBase, ApiError } from './client';

describe('apiBase', () => {
  const w = globalThis as unknown as { MERIDIAN_API_BASE?: string };

  beforeEach(() => {
    delete w.MERIDIAN_API_BASE;
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    delete w.MERIDIAN_API_BASE;
    vi.unstubAllEnvs();
  });

  it('falls back to localhost:8081 when nothing is set', () => {
    expect(apiBase()).toBe('http://localhost:8081');
  });

  it('prefers VITE_API_BASE when present', () => {
    vi.stubEnv('VITE_API_BASE', 'https://meridian.example.gov/api-svc');
    expect(apiBase()).toBe('https://meridian.example.gov/api-svc');
  });

  it('strips a single trailing slash', () => {
    vi.stubEnv('VITE_API_BASE', 'https://svc.example/');
    expect(apiBase()).toBe('https://svc.example');
  });

  it('uses the window global when the env var is unset', () => {
    w.MERIDIAN_API_BASE = 'http://10.0.0.9:8081';
    expect(apiBase()).toBe('http://10.0.0.9:8081');
  });

  it('lets VITE_API_BASE win over the window global', () => {
    vi.stubEnv('VITE_API_BASE', 'http://env-wins:8081');
    w.MERIDIAN_API_BASE = 'http://window-loses:8081';
    expect(apiBase()).toBe('http://env-wins:8081');
  });
});

describe('ApiError', () => {
  it('carries a status and the attempted url', () => {
    const err = new ApiError('boom', 'http://x/api/health', 503);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(503);
    expect(err.url).toBe('http://x/api/health');
  });

  it('allows a null status for network-level failures', () => {
    const err = new ApiError('offline', 'http://x/api/stations', null);
    expect(err.status).toBeNull();
  });
});

describe('getJson (needs fetch mocked)', () => {
  it.todo('throws ApiError with null status on a network failure');
  it.todo('throws ApiError with the HTTP status on a non-2xx response');
  it.todo('throws ApiError when the body is not valid JSON');
  it.todo('passes the AbortSignal through to fetch');
});
