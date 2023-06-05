// src/api/endpoints.test.ts
// A. Baht, 2023-08 — specs for the endpoint functions' path/param wiring.
//
// Written for Vitest, which is not installed (see MIGRATION.md, debt item 4).
// These mock the client's getJson and assert each endpoint hits the right path
// with the right query params — the `station` vs `stnid` asymmetry (the request
// param is `station`, the response field is `stnid`) has tripped people up, so
// it is pinned here.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getJson = vi.fn();
vi.mock('./client', () => ({
  getJson: (...args: unknown[]) => getJson(...args),
}));

import {
  fetchHealth,
  fetchStations,
  fetchForecast,
  fetchSeries,
} from './endpoints';

describe('endpoint wiring', () => {
  beforeEach(() => {
    getJson.mockReset();
    getJson.mockResolvedValue([]);
  });

  it('fetchHealth hits /api/health with no params', async () => {
    await fetchHealth();
    expect(getJson).toHaveBeenCalledWith('/api/health', undefined, undefined);
  });

  it('fetchStations hits /api/stations with no params', async () => {
    await fetchStations();
    expect(getJson).toHaveBeenCalledWith('/api/stations', undefined, undefined);
  });

  it('fetchForecast sends the station id as the `station` param', async () => {
    await fetchForecast('AB-EDM-01');
    expect(getJson).toHaveBeenCalledWith(
      '/api/forecast',
      { station: 'AB-EDM-01' },
      undefined,
    );
  });

  it('fetchSeries sends both `station` and `year`', async () => {
    await fetchSeries('SK-RGN-02', 2023);
    expect(getJson).toHaveBeenCalledWith(
      '/api/series',
      { station: 'SK-RGN-02', year: 2023 },
      undefined,
    );
  });

  it('threads an AbortSignal through when given', async () => {
    const ctrl = new AbortController();
    await fetchForecast('X', ctrl.signal);
    expect(getJson).toHaveBeenCalledWith('/api/forecast', { station: 'X' }, ctrl.signal);
  });
});
