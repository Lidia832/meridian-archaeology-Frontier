// src/components/Spinner.tsx
// M. Osei, 2023-06 — loading indicator + a labelled loading block.

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label ? <span className="muted" style={{ marginLeft: 8 }}>{label}</span> : null}
    </span>
  );
}

/** Full-panel loading state, used while a screen's first fetch is in flight. */
export function LoadingBlock({ label = 'Loading…' }: SpinnerProps) {
  return (
    <div className="empty">
      <Spinner label={label} />
    </div>
  );
}
