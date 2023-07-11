// src/hooks/useStations.ts
// A. Baht, 2023-06 — stations list + client-side sort/filter helpers.

import { useMemo, useState } from 'react';
import { fetchStations } from '../api/endpoints';
import type { StationRow } from '../api/types';
import { useAsync } from './useAsync';

export type StationSortKey = 'stnid' | 'days' | 'first_year' | 'last_year';
export type SortDir = 'asc' | 'desc';

export function useStations() {
  return useAsync<StationRow[]>((signal) => fetchStations(signal), []);
}

/**
 * Sort/filter that runs entirely in the browser. The service does not take a
 * sort or filter parameter (and given MRD-166 we would not want to send it a
 * free-text one anyway), so we pull the whole list — it is small, low hundreds
 * of rows — and slice it here.
 */
export function useStationView(rows: StationRow[] | null) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<StationSortKey>('stnid');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: StationSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const view = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.stnid.toLowerCase().includes(q))
      : rows.slice();
    filtered.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [rows, query, sortKey, sortDir]);

  return { view, query, setQuery, sortKey, sortDir, toggleSort };
}
