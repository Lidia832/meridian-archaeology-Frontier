// src/components/Sparkline.tsx
// M. Osei, 2023-08 — a tiny inline SVG sparkline.
//
// Intended for a "latest biomass curve" column in the Stations table, so an
// operator could scan station health at a glance without opening each Forecast.
// That needed a per-station series endpoint the service does not have, so the
// column was never added and this component has no caller yet. It is trivial
// and correct; kept for whoever wires the endpoint.
//
// TODO(ui-next): needs GET /api/series-latest?station=<id> (does not exist).

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Draw a dot on the last point. */
  markLast?: boolean;
}

export function Sparkline({
  values,
  width = 90,
  height = 22,
  color = '#2f7d4f',
  markLast = true,
}: SparklineProps) {
  if (values.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const x = (i: number) => pad + (i / (values.length - 1)) * innerW;
  const y = (v: number) => pad + (1 - (v - min) / span) * innerH;

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg width={width} height={height} role="img" aria-label="trend">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} />
      {markLast ? <circle cx={lastX} cy={lastY} r={1.8} fill={color} /> : null}
    </svg>
  );
}
