// src/components/ErrorBoundary.tsx
// J. Ferreira, 2023-08 — a class error boundary around the routed content.
//
// The legacy console had no error boundary concept — a thrown exception in one
// widget took the whole page down to a blank screen with a stack trace only in
// the console. This catches a render-time throw in any screen and shows a
// recoverable panel instead, with a "reload this screen" that resets the
// boundary without a full page refresh.
//
// It is deliberately plain. There is no error-reporting backend to POST to
// (that was going to be a Settings-era decision, and Settings is a stub), so
// the error is logged and shown, nothing more.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry endpoint exists; console is the only sink.
    // eslint-disable-next-line no-console
    console.error('[ui-next] uncaught render error:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="panel" style={{ margin: 24 }}>
        <h3>This screen crashed.</h3>
        <p className="muted">
          A screen in ui-next threw while rendering. This is a bug in the rewrite,
          not a service problem — the legacy console at{' '}
          <span className="mono">/console</span> is unaffected.
        </p>
        <pre
          className="mono"
          style={{
            whiteSpace: 'pre-wrap',
            background: '#faf9f4',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: 10,
            fontSize: 12,
            overflowX: 'auto',
          }}
        >
          {error.message}
        </pre>
        <button className="btn" onClick={this.reset}>
          Reload this screen
        </button>
      </div>
    );
  }
}
