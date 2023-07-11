// src/screens/StationsScreen.tsx
// J. Ferreira, 2023-06 — SCREEN 1 OF 3 (migrated). Station overview.
//
// Replaces the #stations table in dashboard/js/dashboard.js. That one was a
// static, unsorted list built by string concatenation. This adds client-side
// search and column sorting (the list is small — pulling it whole and slicing
// in the browser is fine, and avoids handing free text to the SQL-by-concat
// service, MRD-166). Clicking a station jumps to its Forecast screen.

import { useNavigate } from 'react-router-dom';
import { PageHead } from '../components/PageHead';
import { LoadingBlock } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { useStations, useStationView, type StationSortKey } from '../hooks/useStations';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { integer, yearRange } from '../util/format';
import { downloadCsv } from '../util/csv';
import type { StationRow } from '../api/types';

const COLUMNS: { key: StationSortKey; label: string; num: boolean }[] = [
  { key: 'stnid', label: 'Station', num: false },
  { key: 'days', label: 'Records', num: true },
  { key: 'first_year', label: 'First year', num: true },
  { key: 'last_year', label: 'Last year', num: true },
];

export function StationsScreen() {
  useDocumentTitle('Stations');
  const nav = useNavigate();
  const { status, data, error, firstLoad, reload } = useStations();
  const { view, query, setQuery, sortKey, sortDir, toggleSort } = useStationView(data);

  const totalRecords = view.reduce((sum, r) => sum + r.days, 0);

  function exportCsv() {
    const cols: [keyof StationRow, string][] = [
      ['stnid', 'Station'],
      ['days', 'Records'],
      ['first_year', 'First year'],
      ['last_year', 'Last year'],
    ];
    downloadCsv(`meridian-stations-${new Date().toISOString().slice(0, 10)}.csv`, view, cols);
  }

  return (
    <>
      <PageHead
        title="Stations"
        crumb="ui-next · screen 1 of 3 migrated"
        actions={
          <button className="btn" onClick={reload} disabled={status === 'loading'}>
            Refresh
          </button>
        }
      />

      {status === 'loading' && firstLoad ? <LoadingBlock label="Loading stations…" /> : null}
      {status === 'error' && error ? <ErrorBanner error={error} onRetry={reload} /> : null}

      {data ? (
        <div className="panel">
          <div className="toolbar">
            <input
              type="search"
              placeholder="Filter by station id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter stations"
            />
            <span className="count">
              {view.length} of {data.length} stations
              {view.length ? ` · ${integer(totalRecords)} records` : ''}
            </span>
            <button className="btn" onClick={exportCsv} disabled={view.length === 0}>
              Export CSV
            </button>
            {status === 'loading' ? <span className="spinner" aria-hidden="true" /> : null}
          </div>

          {view.length === 0 ? (
            <EmptyState
              title="No stations match."
              detail={query ? `Nothing matches "${query}".` : 'The service returned an empty list.'}
            />
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`sortable ${c.num ? 'num' : ''}`}
                      onClick={() => toggleSort(c.key)}
                      title={`Sort by ${c.label}`}
                    >
                      {c.label}
                      {sortKey === c.key ? (
                        <span className="arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr
                    key={r.stnid}
                    className="clickable"
                    onClick={() => nav(`/forecast?station=${encodeURIComponent(r.stnid)}`)}
                    title={`Open forecast for ${r.stnid}`}
                  >
                    <td className="mono">{r.stnid}</td>
                    <td className="num">{integer(r.days)}</td>
                    <td className="num">{r.first_year}</td>
                    <td className="num" title={yearRange(r.first_year, r.last_year)}>{r.last_year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      <p className="muted" style={{ fontSize: 12 }}>
        Tip: click a station to open its forecast. The other eight screens are
        still in the legacy console (<span className="mono">/console</span>).
      </p>
    </>
  );
}
