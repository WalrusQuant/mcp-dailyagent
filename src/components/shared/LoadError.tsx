import { RefreshCw } from "lucide-react";

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
        style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
      >
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
