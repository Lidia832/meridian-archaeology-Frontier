// src/screens/ForecastScreen.tsx
// J. Ferreira, 2023-07 — SCREEN 2 OF 3 (migrated). Forecast detail + series.
//
// This is the screen that justified the whole rewrite. In the legacy console
// the equivalent was three linked <table>s and a DOM bar chart of a single
// channel (biomass), because there was no build step to bring in a real chart
// (MRD-181). Here the same three tables share state through the URL, and the
// series drives a genuine multi-channel SVG chart (components/SeriesChart).
//
// State lives in the query string (?station=&year=) so an operator can deep-link
// a specific run — the legacy console could not be linked to at all.

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHead } from '../components/PageHead';
import { LoadingBlock, Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { SeriesChart } from '../components/SeriesChart';
import { useStations } from '../hooks/useStations';
import { useForecast, latestYear } from '../hooks/useForecast';
import { useSeries, isDoyMonotonic } from '../hooks/useSeries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { fixed, timeAgo } from '../util/format';
import { doyLabel } from '../util/doy';
import { downloadCsv } from '../util/csv';
import type { SeriesRow } from '../api/types';

export function ForecastScreen() {
  const [params, setParams] = useSearchParams();
  const station = params.get('station');
  const yearParam = params.get('year');
  const year = yearParam ? Number(yearParam) : null;

  // Station picker source. Small list; reuse the stations endpoint.
  const stations = useStations();

  // If no station is selected yet, default to the first one once it loads.
  useEffect(() => {
    if (!station && stations.data && stations.data.length > 0) {
      setParams({ station: stations.data[0].stnid }, { replace: true });
    }
  }, [station, stations.data, setParams]);

  const forecast = useForecast(station);

  // Default the year to the most recent run once the forecast loads.
  const newestYear = latestYear(forecast.data);
  useEffect(() => {
    if (station && year == null && newestYear != null) {
      setParams({ station, year: String(newestYear) }, { replace: true });
    }
  }, [station, year, newestYear, setParams]);

  const series = useSeries(station, year);
  const monotonic = useMemo(() => isDoyMonotonic(series.data), [series.data]);

  useDocumentTitle(station ? `Forecast · ${station}` : 'Forecast');

  function pickStation(stn: string) {
    // Changing station clears the year so it re-defaults to that station's latest.
    setParams({ station: stn });
  }

  function pickYear(y: number) {
    if (station) setParams({ station, year: String(y) });
  }

  function exportSeries() {
    if (!series.data || !station || year == null) return;
    const cols: [keyof SeriesRow, string][] = [
      ['doy', 'DOY'],
      ['sw', 'SW_mm'],
      ['et', 'ET_mm_day'],
      ['drain', 'Drain_mm_day'],
      ['biom', 'Biomass_kg_ha'],
      ['lai', 'LAI'],
    ];
    downloadCsv(`meridian-series-${station}-${year}.csv`, series.data, cols);
  }

  return (
    <>
      <PageHead
        title="Forecast"
        crumb="ui-next · screen 2 of 3 migrated"
        actions={
          <select
            aria-label="Station"
            value={station ?? ''}
            onChange={(e) => pickStation(e.target.value)}
            disabled={!stations.data}
          >
            {!stations.data ? <option>loading…</option> : null}
            {stations.data?.map((s) => (
              <option key={s.stnid} value={s.stnid}>
                {s.stnid}
              </option>
            ))}
          </select>
        }
      />

      {stations.status === 'error' && stations.error ? (
        <ErrorBanner error={stations.error} onRetry={stations.reload} />
      ) : null}

      {!station ? (
        <EmptyState title="Select a station to view its forecast runs." />
      ) : (
        <div className="row">
          {/* ---- forecast runs ---- */}
          <section className="panel grow" style={{ flexBasis: 380 }}>
            <h3>Forecast runs · {station}</h3>

            {forecast.status === 'loading' && forecast.firstLoad ? (
              <LoadingBlock label="Loading runs…" />
            ) : null}
            {forecast.status === 'error' && forecast.error ? (
              <ErrorBanner error={forecast.error} onRetry={forecast.reload} />
            ) : null}

            {forecast.data && forecast.data.length === 0 ? (
              <EmptyState title="No forecast runs for this station." />
            ) : null}

            {forecast.data && forecast.data.length > 0 ? (
              <table className="grid">
                <thead>
                  <tr>
                    <th className="num">Year</th>
                    <th className="num">Yield (t/ha)</th>
                    <th className="num">Days</th>
                    <th>Model</th>
                    <th>Run at</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.data
                    .slice()
                    .sort((a, b) => b.year - a.year)
                    .map((r) => (
                      <tr
                        key={`${r.stnid}-${r.year}-${r.run_at}`}
                        className={`clickable ${r.year === year ? 'sel' : ''}`}
                        onClick={() => pickYear(r.year)}
                        title={`Show ${r.year} daily series`}
                      >
                        <td className="num mono">{r.year}</td>
                        <td className="num">{fixed(r.yield_t, 3)}</td>
                        <td className="num">{r.ndays}</td>
                        <td className="mono">{r.model}</td>
                        <td className="mono" style={{ fontSize: 12 }} title={timeAgo(r.run_at)}>
                          {r.run_at}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : null}
          </section>

          {/* ---- daily series + chart ---- */}
          <section className="panel grow" style={{ flexBasis: 520 }}>
            <h3>
              Daily series {year ? `· ${station} · ${year}` : ''}
              {series.status === 'loading' && !series.firstLoad ? (
                <span style={{ marginLeft: 8 }}>
                  <Spinner />
                </span>
              ) : null}
            </h3>

            {year == null ? (
              <EmptyState title="Pick a run year on the left to load its daily series." />
            ) : null}

            {year != null && series.status === 'loading' && series.firstLoad ? (
              <LoadingBlock label="Loading series…" />
            ) : null}
            {series.status === 'error' && series.error ? (
              <ErrorBanner error={series.error} onRetry={series.reload} />
            ) : null}

            {series.data && series.data.length === 0 ? (
              <EmptyState title="No daily records for this station/year." />
            ) : null}

            {series.data && series.data.length > 0 ? (
              <>
                {!monotonic ? (
                  <div className="banner warn" role="alert">
                    Daily records are not in ascending day-of-year order. The
                    legacy water-balance model assumes they are (MRD-118); the
                    chart below shows them exactly as returned.
                  </div>
                ) : null}

                <SeriesChart rows={series.data} />

                <div className="toolbar" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={exportSeries}>
                    Export series CSV
                  </button>
                  <span className="count">{series.data.length} daily records</span>
                </div>

                <details style={{ marginTop: 12 }}>
                  <summary className="muted" style={{ cursor: 'pointer' }}>
                    Show {series.data.length} daily rows
                  </summary>
                  <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
                    <table className="grid">
                      <thead>
                        <tr>
                          <th className="num">DOY</th>
                          <th>Date</th>
                          <th className="num">SW</th>
                          <th className="num">ET</th>
                          <th className="num">Drain</th>
                          <th className="num">Biomass</th>
                          <th className="num">LAI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {series.data.map((r) => (
                          <tr key={r.doy}>
                            <td className="num mono">{r.doy}</td>
                            <td className="muted">{year != null ? doyLabel(year, r.doy) : ''}</td>
                            <td className="num">{fixed(r.sw, 1)}</td>
                            <td className="num">{fixed(r.et, 2)}</td>
                            <td className="num">{fixed(r.drain, 2)}</td>
                            <td className="num">{fixed(r.biom, 0)}</td>
                            <td className="num">{fixed(r.lai, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
