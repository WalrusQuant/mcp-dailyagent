"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Suspense } from "react";

function OAuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "unknown_error";
  const errorDescription = searchParams.get("error_description") || "An unexpected error occurred during authorization.";

  return (
    <div
      className="rounded-xl p-6 text-center"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div className="flex justify-center mb-4">
        <AlertCircle className="w-10 h-10" style={{ color: "var(--accent-negative)" }} />
      </div>

      <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Authorization Failed
      </h1>

      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {errorDescription}
      </p>

      <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
        Error: {error}
      </p>
    </div>
  );
}

export default function OAuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <p style={{ color: "var(--text-muted)" }}>Loading...</p>
        </div>
      }
    >
      <OAuthErrorContent />
    </Suspense>
  );
}
