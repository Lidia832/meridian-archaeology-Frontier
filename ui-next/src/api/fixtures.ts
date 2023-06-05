// src/api/fixtures.ts
// J. Ferreira, 2023-06 — sample payloads used during the first weeks of the
// migration, before the Java service returned anything on the dev box.
//
// These are hand-authored to match the four response shapes exactly so the
// three screens could be built against something real-looking. They are no
// longer imported by the app — the screens hit the live service now — but they
// were the reference the types were checked against, and a never-built
// Storybook was going to render off them. Kept as documentation-by-example of
// the contract. If the service shape and these ever disagree, the service wins.
//
// TODO(ui-next): wire these into a Storybook / MSW mock once that exists.

import type {
  HealthResponse,
  StationRow,
  ForecastRow,
  SeriesRow,
} from './types';

export const FX_HEALTH: HealthResponse = { status: 'ok', version: '4.2.1' };

export const FX_STATIONS: StationRow[] = [
  { stnid: 'AB-EDM-01', days: 9132, first_year: 1998, last_year: 2023 },
  { stnid: 'AB-LTH-04', days: 7410, first_year: 2003, last_year: 2023 },
  { stnid: 'SK-RGN-02', days: 10233, first_year: 1995, last_year: 2023 },
  { stnid: 'SK-STN-11', days: 4021, first_year: 2012, last_year: 2023 },
  { stnid: 'MB-BRA-03', days: 6650, first_year: 2005, last_year: 2022 },
  { stnid: 'MB-WPG-07', days: 8890, first_year: 1999, last_year: 2023 },
  { stnid: 'ON-GLP-09', days: 3311, first_year: 2014, last_year: 2023 },
  { stnid: 'ON-LDN-05', days: 5540, first_year: 2008, last_year: 2023 },
];

export const FX_FORECAST: ForecastRow[] = [
  { stnid: 'AB-EDM-01', year: 2021, yield_t: 4.128, ndays: 178, model: 'cropmod-1.3', run_at: '2021-10-02T04:11:00' },
  { stnid: 'AB-EDM-01', year: 2022, yield_t: 3.964, ndays: 181, model: 'cropmod-1.4', run_at: '2022-10-01T04:07:00' },
  { stnid: 'AB-EDM-01', year: 2023, yield_t: 4.402, ndays: 176, model: 'cropmod-1.4', run_at: '2023-10-03T04:09:00' },
];

// One synthetic growing season. Ascending DOY (see MRD-118), Apr 20 -> Oct 12.
// Soil water drifts down through summer, ET peaks mid-season, biomass and LAI
// follow a sigmoid, drainage spikes early. Enough shape to exercise the chart.
export const FX_SERIES: SeriesRow[] = buildSyntheticSeason();

function buildSyntheticSeason(): SeriesRow[] {
  const rows: SeriesRow[] = [];
  const start = 110; // ~Apr 20
  const end = 285; // ~Oct 12
  for (let doy = start; doy <= end; doy += 1) {
    const t = (doy - start) / (end - start); // 0..1 through the season
    const sigmoid = 1 / (1 + Math.exp(-10 * (t - 0.45)));
    const seasonal = Math.sin(Math.PI * t); // 0 at ends, 1 mid-season
    const sw = 180 - 90 * t + 18 * Math.sin(doy / 6); // soil water mm
    const et = 1.2 + 4.4 * seasonal + 0.3 * Math.sin(doy / 3); // mm/day
    const drain = Math.max(0, 3.5 * Math.exp(-t * 6) + 0.4 * Math.sin(doy / 4));
    const biom = 12000 * sigmoid; // kg/ha
    const lai = 5.6 * sigmoid;
    rows.push({
      doy,
      sw: round(sw, 1),
      et: round(et, 2),
      drain: round(drain, 2),
      biom: round(biom, 0),
      lai: round(lai, 2),
    });
  }
  return rows;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
