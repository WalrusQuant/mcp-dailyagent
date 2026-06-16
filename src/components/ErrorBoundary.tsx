"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center h-full p-8"
          style={{ background: "var(--bg-base)" }}
        >
          <div className="flex flex-col items-center max-w-md text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(248, 113, 113, 0.1)" }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: "var(--accent-negative)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Something went wrong
            </h2>
            <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
              An unexpected error occurred. Try again, or reload the page.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium"
                style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg transition-colors font-medium"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
              >
                Reload page
              </button>
              <a
                href="/dashboard"
                className="px-4 py-2 rounded-lg transition-colors font-medium"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
              >
                Go to dashboard
              </a>
            </div>
            {this.state.error?.message && (
              <details className="mt-6 text-left max-w-full">
                <summary className="text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                  Technical details
                </summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words" style={{ color: "var(--text-muted)" }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
