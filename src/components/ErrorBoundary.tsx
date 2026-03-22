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
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium"
              style={{ background: "var(--accent-primary)", color: "var(--bg-base)" }}
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
