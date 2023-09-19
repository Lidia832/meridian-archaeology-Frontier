// src/components/DataTable.tsx
// K. Duval, 2023-08 — a generic sortable table, extracted for the Compare
// screen and never adopted.
//
// The Stations screen grew its own sort/filter (hooks/useStations) first. When
// Compare was scoped it obviously needed the same behaviour over an arbitrary
// row shape, so this generic version was pulled out to share. Compare never got
// built, and nobody went back to retrofit Stations onto this, so it sits here
// with one intended caller and zero real ones.
//
// It is complete and typed. If you resume Compare, start here. If you touch
// Stations, consider collapsing its bespoke table into this one.
//
// TODO(ui-next): adopt in StationsScreen; first new caller is Compare.

import { useMemo, useState, type ReactNode } from 'react';

export interface Column<Row> {
  /** Stable key; also the default sort accessor when `sortValue` is absent. */
  key: keyof Row & string;
  header: string;
  /** Right-align + tabular numerals. */
  numeric?: boolean;
  /** Custom cell render. Defaults to String(row[key]). */
  render?: (row: Row) => ReactNode;
  /** Custom sort value; defaults to row[key]. */
  sortValue?: (row: Row) => string | number;
  /** Set false to make a column unsortable. */
  sortable?: boolean;
}

type SortDir = 'asc' | 'desc';

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  /** Stable row key. */
  rowKey: (row: Row) => string;
  /** Optional click handler; makes rows look clickable. */
  onRowClick?: (row: Row) => void;
  /** Predicate for the currently-selected row (adds the .sel class). */
  isSelected?: (row: Row) => boolean;
  /** Initial sort column key. */
  initialSort?: keyof Row & string;
  emptyText?: string;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  isSelected,
  initialSort,
  emptyText = 'No rows.',
}: DataTableProps<Row>) {
  const [sortKey, setSortKey] = useState<(keyof Row & string) | null>(
    initialSort ?? null,
  );
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const colByKey = useMemo(() => {
    const m = new Map<string, Column<Row>>();
    for (const c of columns) m.set(c.key, c);
    return m;
  }, [columns]);

  function toggle(key: keyof Row & string) {
    const col = colByKey.get(key);
    if (col && col.sortable === false) return;
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = colByKey.get(sortKey);
    const value = (row: Row): string | number =>
      col?.sortValue ? col.sortValue(row) : (row[sortKey] as unknown as string | number);
    const out = rows.slice();
    out.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [rows, sortKey, sortDir, colByKey]);

  if (rows.length === 0) {
    return <div className="empty">{emptyText}</div>;
  }

  return (
    <table className="grid">
      <thead>
        <tr>
          {columns.map((c) => {
            const canSort = c.sortable !== false;
            return (
              <th
                key={c.key}
                className={`${c.numeric ? 'num' : ''} ${canSort ? 'sortable' : ''}`.trim()}
                onClick={canSort ? () => toggle(c.key) : undefined}
                title={canSort ? `Sort by ${c.header}` : undefined}
              >
                {c.header}
                {sortKey === c.key ? (
                  <span className="arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>
                ) : null}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr
            key={rowKey(row)}
            className={[
              onRowClick ? 'clickable' : '',
              isSelected?.(row) ? 'sel' : '',
            ].join(' ').trim()}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((c) => (
              <td key={c.key} className={c.numeric ? 'num' : ''}>
                {c.render ? c.render(row) : String(row[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
