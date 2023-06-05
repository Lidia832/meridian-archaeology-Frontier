// src/api/endpoints.ts
// J. Ferreira, 2023-06 — one function per endpoint of the Meridian contract.
//
// These mirror dashboard/js/api.js exactly, endpoint for endpoint, so that a
// reviewer diffing the old console against ui-next can line them up. The only
// difference is the types and the AbortSignal plumbing.

import { getJson } from './client';
import type {
  HealthResponse,
  StationRow,
  ForecastRow,
  SeriesRow,
} from './types';

/** GET /api/health -> {status, version} */
export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return getJson<HealthResponse>('/api/health', undefined, signal);
}

/** GET /api/stations -> StationRow[] */
export function fetchStations(signal?: AbortSignal): Promise<StationRow[]> {
  return getJson<StationRow[]>('/api/stations', undefined, signal);
}

/** GET /api/forecast?station=<id> -> ForecastRow[] */
export function fetchForecast(
  station: string,
  signal?: AbortSignal,
): Promise<ForecastRow[]> {
  // The query param is `station`, not `stnid`. The response rows call the same
  // value `stnid`. That asymmetry lives in the Java handler; we just honour it.
  return getJson<ForecastRow[]>('/api/forecast', { station }, signal);
}

/** GET /api/series?station=<id>&year=<yyyy> -> SeriesRow[] */
export function fetchSeries(
  station: string,
  year: number,
  signal?: AbortSignal,
): Promise<SeriesRow[]> {
  return getJson<SeriesRow[]>('/api/series', { station, year }, signal);
}

// TODO(ui-next): the following endpoints were assumed to exist when the eight
// remaining screens were scoped, but the Java service never grew them. Left
// here as a record of what the stalled screens would have needed:
//   GET /api/anomalies?station=<id>        (Anomalies screen)
//   GET /api/quality?station=<id>          (Data Quality screen)
//   GET /api/ingest/status                 (Ingest Monitor screen)
//   GET /api/runs                          (Model Runs screen)
//   GET /api/audit                         (Audit Log screen)
// Do not add stubs that hit these — they will 404. — J.F. 2023-08
