// src/api/types.ts
// J. Ferreira, 2023-06 — types transcribed by hand from the Java handlers.
//
// The service does not publish an OpenAPI document (MRD backlog item, never
// scheduled), so these interfaces are a hand-copy of what the handlers in
// services/src/ca/meridian/api/*.java actually return. If the service shape
// changes, nothing here will complain until runtime. That is a known risk we
// accepted to get the first three screens out the door.
//
// Contract (do NOT change — the Java service owns it):
//   GET /api/health                         -> HealthResponse
//   GET /api/stations                       -> StationRow[]
//   GET /api/forecast?station=<id>          -> ForecastRow[]
//   GET /api/series?station=<id>&year=<yyyy> -> SeriesRow[]

/** GET /api/health */
export interface HealthResponse {
  status: string; // "ok" in the happy path; anything else is degraded
  version: string; // e.g. "4.2.1"
}

/** One row of GET /api/stations */
export interface StationRow {
  stnid: string;
  /** Count of daily reading records held for the station. */
  days: number;
  first_year: number;
  last_year: number;
}

/** One row of GET /api/forecast?station=<id> */
export interface ForecastRow {
  stnid: string;
  year: number;
  /** Forecast seasonal yield, tonnes/ha. Serialized as a JSON number. */
  yield_t: number;
  /** Number of daily records that fed the run. */
  ndays: number;
  /** Model identifier, e.g. "cropmod-1.4". */
  model: string;
  /** ISO-ish timestamp string as emitted by the service; not parsed. */
  run_at: string;
}

/** One row of GET /api/series?station=<id>&year=<yyyy> */
export interface SeriesRow {
  /** Day of year, 1..365(6). The legacy model assumes ascending order (MRD-118). */
  doy: number;
  /** Soil water (mm). */
  sw: number;
  /** Evapotranspiration (mm/day). */
  et: number;
  /** Drainage (mm/day). */
  drain: number;
  /** Above-ground biomass (kg/ha). */
  biom: number;
  /** Leaf area index (dimensionless). */
  lai: number;
}

/** The numeric channels a SeriesRow carries, for the chart's channel picker. */
export type SeriesChannel = 'sw' | 'et' | 'drain' | 'biom' | 'lai';

export interface SeriesChannelMeta {
  key: SeriesChannel;
  label: string;
  unit: string;
  color: string;
}
