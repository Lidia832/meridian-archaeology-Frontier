# Meridian operator console — ui-next

A 2023 React + Vite rewrite of the legacy Meridian operator console
(`../dashboard`). **It is unfinished.** It covers 3 of the 11 planned
screens and has been stalled since September 2023 (tracker item
**MRD-219**). Both consoles — this one and the legacy jQuery console — are
deployed and talk to the same Java service.

> If you are here to *use* the console day to day, use the legacy console at
> `/console`. Only Stations, Forecast and Health work here.
> If you are here to *finish the migration*, start with
> [`MIGRATION.md`](./MIGRATION.md).

## Why two consoles exist

The legacy console (`dashboard/`) has no build step at all (MRD-181): it
vendors jQuery and draws its one chart out of absolutely-positioned `<div>`s
because adding a charting library needed a bundler and there wasn't one.
ui-next was the answer to that — a real build, a module graph, a real chart.
The bet was sound; it just didn't get finished. The team was pulled onto the
ingest backpressure incident (MRD-201 fallout) and nobody has owned the
migration since.

## What works

| Screen   | Route        | Backed by                                   |
|----------|--------------|---------------------------------------------|
| Stations | `/stations`  | `GET /api/stations`                         |
| Forecast | `/forecast`  | `GET /api/forecast`, `GET /api/series`      |
| Health   | `/health`    | `GET /api/health`                           |

The other eight routes (`/anomalies`, `/compare`, `/quality`, `/ingest`,
`/runs`, `/audit`, `/settings`, `/about`) render a **"not yet migrated"**
placeholder and point back at the legacy console. They are intentionally
visible in the nav (tagged `stub`) rather than hidden.

## Stack

- **Vite 5** + **React 18** + **TypeScript**
- **React Router 6** for the 11 routes
- Typed API client in `src/api/` (hand-transcribed from the Java handlers;
  the service publishes no OpenAPI document)
- Data hooks in `src/hooks/` (a hand-rolled `useAsync`; react-query was
  planned, never added)
- Hand-rolled multi-channel **SVG chart** in `src/components/SeriesChart.tsx`
  (recharts was planned, never added)

No test suite and no linter config landed — see `MIGRATION.md`.

## API contract (consumed, not owned)

The Java service on `:8081` owns these shapes. Do not change them here.

```
GET /api/health                          -> { "status": "ok", "version": "4.2.1" }
GET /api/stations                        -> [ { stnid, days, first_year, last_year }, ... ]
GET /api/forecast?station=<id>           -> [ { stnid, year, yield_t, ndays, model, run_at }, ... ]
GET /api/series?station=<id>&year=<yyyy> -> [ { doy, sw, et, drain, biom, lai }, ... ]
```

Query parameters are `station` and `year`. All responses are JSON.

## Configuration

The API base URL is read from `VITE_API_BASE` at build time
(default `http://localhost:8081`). Copy `.env.example` to `.env` to override.
There is also a `window.MERIDIAN_API_BASE` escape hatch, mirroring the legacy
console, for hand-deploys.

## Develop / build

```sh
npm install
npm run dev       # Vite dev server on :5174, proxies /api -> VITE_API_BASE
npm run build     # tsc -b && vite build  ->  dist/
npm run preview   # serve the production build locally
```

The dev server proxies `/api` to the service so local dev needs no CORS. In
production the app calls `VITE_API_BASE` directly.

## Layout

```
src/
  api/         typed client + endpoint fns + hand-copied types
  hooks/       useAsync, useHealth, useStations, useForecast, useSeries
  components/  Layout, NavSidebar, SeriesChart, StubScreen, small UI bits
  screens/     one file per route (3 real, 8 stubs, + NotFound)
  config/      roadmap.ts (the 3/11 ledger), nav.ts, channels.ts
  styles/      global.css (+ two CSS modules)
```

`src/config/roadmap.ts` is the single source of truth for which screens are
done. The nav, the About page and this repo's `MIGRATION.md` all derive from
it. Change a screen's status there.

---
*Meridian Web Team, 2023. Last real commit 2023-09. See MIGRATION.md.*
