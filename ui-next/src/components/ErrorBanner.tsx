// src/components/ErrorBanner.tsx
// M. Osei, 2023-06 — surfaces an ApiError/Error with an optional retry.
//
// The legacy console printed "API unreachable" into a table cell and left it
// there. This at least tells you the URL it tried and lets you retry without a
// full reload.

import { ApiError } from '../api/client';

interface ErrorBannerProps {
  error: Error | ApiError;
  onRetry?: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const isApi = error instanceof ApiError;
  return (
    <div className="banner error" role="alert">
      <strong>Could not load data. </strong>
      <span>{error.message}</span>
      {isApi && (error as ApiError).url ? (
        <div className="mono" style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
          {(error as ApiError).url}
        </div>
      ) : null}
      {onRetry ? (
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={onRetry}>Retry</button>
        </div>
      ) : null}
    </div>
  );
}
