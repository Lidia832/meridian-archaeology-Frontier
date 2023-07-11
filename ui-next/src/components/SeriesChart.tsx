// src/components/SeriesChart.tsx
// M. Osei, 2023-07 — the payoff of having a build step.
//
// The legacy console (dashboard/js/drawChart) drew a single-channel bar chart
// by appending absolutely-positioned <div>s, because it had no build step and
// therefore no charting library (MRD-181). ui-next has a build step, so it
// could pull in recharts — that WAS the plan (see MIGRATION.md, "chart" line).
// It never got done. What shipped instead is this: a hand-rolled multi-channel
// SVG line chart with a legend, per-channel toggles and a hover readout.
//
// It is deliberately dependency-free. Each channel is normalised to its own
// [min,max] so five quantities on different scales (mm, kg/ha, index) can share
// one plot; the tooltip shows the real values, not the normalised ones.
//
// TODO(ui-next): swap for recharts once the migration resumes and we can afford
// the bundle. Until then this is the only real chart in the app. — M.O. 2023-08

import { useMemo, useRef, useState } from 'react';
import type { SeriesRow, SeriesChannel } from '../api/types';
import { CHANNEL_META } from '../config/channels';
import { useSeriesExtents } from '../hooks/useSeries';
import { smart } from '../util/format';
import styles from './SeriesChart.module.css';

// viewBox geometry. The SVG scales to its container via CSS width:100%.
const VBW = 760;
const VBH = 320;
const PAD = { l: 46, r: 14, t: 14, b: 30 };
const PLOT_W = VBW - PAD.l - PAD.r;
const PLOT_H = VBH - PAD.t - PAD.b;

interface SeriesChartProps {
  rows: SeriesRow[];
}

interface HoverState {
  index: number;
  px: number; // pixel x within the wrapper, for tooltip placement
  py: number;
}

export function SeriesChart({ rows }: SeriesChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hidden, setHidden] = useState<Set<SeriesChannel>>(new Set());
  const [hover, setHover] = useState<HoverState | null>(null);

  const extents = useSeriesExtents(rows);

  const doyMin = rows.length ? rows[0].doy : 0;
  const doyMax = rows.length ? rows[rows.length - 1].doy : 1;
  const doySpan = Math.max(1, doyMax - doyMin);

  const xOf = (doy: number) => PAD.l + ((doy - doyMin) / doySpan) * PLOT_W;

  const yOf = (ch: SeriesChannel, v: number) => {
    const { min, max } = extents[ch];
    const span = max - min;
    const norm = span > 0 ? (v - min) / span : 0.5; // flat channel sits mid-plot
    return PAD.t + (1 - norm) * PLOT_H;
  };

  // Precompute the polyline point strings for each visible channel.
  const paths = useMemo(() => {
    return CHANNEL_META.filter((c) => !hidden.has(c.key)).map((c) => {
      const pts = rows
        .map((r) => `${xOf(r.doy).toFixed(1)},${yOf(c.key, r[c.key]).toFixed(1)}`)
        .join(' ');
      return { key: c.key, color: c.color, points: pts };
    });
    // xOf/yOf depend on rows+extents, both stable per render here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, hidden, extents]);

  // X-axis ticks: ~6 evenly spaced DOY labels.
  const xTicks = useMemo(() => {
    const n = Math.min(6, rows.length);
    if (n <= 1) return rows.map((r) => r.doy);
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.round((i / (n - 1)) * (rows.length - 1));
      out.push(rows[idx].doy);
    }
    return Array.from(new Set(out));
  }, [rows]);

  function toggle(ch: SeriesChannel) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || rows.length === 0) return;
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    // Map pixel x -> viewBox x -> nearest data index.
    const scale = svgRect.width / VBW;
    const vbX = (e.clientX - svgRect.left) / scale;
    const frac = (vbX - PAD.l) / PLOT_W;
    const targetDoy = doyMin + frac * doySpan;
    // nearest row by doy
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const d = Math.abs(rows[i].doy - targetDoy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover({
      index: best,
      px: e.clientX - wrapRect.left,
      py: e.clientY - wrapRect.top,
    });
  }

  if (rows.length === 0) return null;

  const hoverRow = hover ? rows[hover.index] : null;
  const hoverX = hoverRow ? xOf(hoverRow.doy) : 0;
  const gridFracs = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={styles.wrap} ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${VBW} ${VBH}`}
        role="img"
        aria-label="Daily water-balance and growth series"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* horizontal gridlines (normalised scale, so no numeric y labels) */}
        {gridFracs.map((f) => {
          const y = PAD.t + f * PLOT_H;
          return (
            <line
              key={`g${f}`}
              className={styles.gridline}
              x1={PAD.l}
              x2={PAD.l + PLOT_W}
              y1={y}
              y2={y}
            />
          );
        })}

        {/* axes */}
        <line className={styles.axis} x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + PLOT_H} />
        <line
          className={styles.axis}
          x1={PAD.l}
          y1={PAD.t + PLOT_H}
          x2={PAD.l + PLOT_W}
          y2={PAD.t + PLOT_H}
        />

        {/* y caption — the plot is per-channel normalised */}
        <text
          className={styles.axisLabel}
          x={12}
          y={PAD.t + PLOT_H / 2}
          transform={`rotate(-90 12 ${PAD.t + PLOT_H / 2})`}
          textAnchor="middle"
        >
          normalised (per channel)
        </text>

        {/* x ticks */}
        {xTicks.map((doy) => (
          <g key={`x${doy}`}>
            <line
              className={styles.axis}
              x1={xOf(doy)}
              x2={xOf(doy)}
              y1={PAD.t + PLOT_H}
              y2={PAD.t + PLOT_H + 4}
            />
            <text
              className={styles.axisLabel}
              x={xOf(doy)}
              y={PAD.t + PLOT_H + 16}
              textAnchor="middle"
            >
              {doy}
            </text>
          </g>
        ))}
        <text
          className={styles.axisLabel}
          x={PAD.l + PLOT_W / 2}
          y={VBH - 2}
          textAnchor="middle"
        >
          day of year
        </text>

        {/* channel lines */}
        {paths.map((p) => (
          <polyline key={p.key} className={styles.line} points={p.points} stroke={p.color} />
        ))}

        {/* hover marker */}
        {hoverRow ? (
          <g>
            <line
              className={styles.hoverLine}
              x1={hoverX}
              x2={hoverX}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
            />
            {CHANNEL_META.filter((c) => !hidden.has(c.key)).map((c) => (
              <circle
                key={`d${c.key}`}
                className={styles.dot}
                cx={hoverX}
                cy={yOf(c.key, hoverRow[c.key])}
                r={3}
                fill={c.color}
              />
            ))}
          </g>
        ) : null}
      </svg>

      {/* tooltip */}
      {hover && hoverRow ? (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(hover.px + 12, (wrapRef.current?.clientWidth ?? 0) - 150),
            top: Math.max(hover.py - 12, 4),
          }}
        >
          <div className={styles.tRow}>
            <span className={styles.tKey}>DOY</span>
            <span>{hoverRow.doy}</span>
          </div>
          {CHANNEL_META.filter((c) => !hidden.has(c.key)).map((c) => (
            <div className={styles.tRow} key={`t${c.key}`}>
              <span className={styles.tKey} style={{ color: c.color }}>
                {c.label}
              </span>
              <span>
                {smart(hoverRow[c.key])}
                {c.unit ? ` ${c.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* legend / toggles */}
      <div className={styles.legend}>
        {CHANNEL_META.map((c) => {
          const off = hidden.has(c.key);
          return (
            <span
              key={c.key}
              className={`${styles.legendItem} ${off ? styles.legendOff : ''}`}
              onClick={() => toggle(c.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') toggle(c.key);
              }}
              title={off ? `Show ${c.label}` : `Hide ${c.label}`}
            >
              <span className={styles.swatch} style={{ background: c.color }} />
              {c.label}
              {c.unit ? <span className="muted"> ({c.unit})</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
