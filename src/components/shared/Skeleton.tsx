"use client";

interface SkeletonProps {
  variant?: "text" | "rectangle" | "circle";
  width?: string;
  height?: string;
  lines?: number;
  className?: string;
}

export function Skeleton({ variant = "text", width, height, lines = 1, className = "" }: SkeletonProps) {
  if (variant === "circle") {
    return (
      <div
        className={`skeleton rounded-full ${className}`}
        style={{ width: width || "40px", height: height || width || "40px" }}
      />
    );
  }

  if (variant === "rectangle") {
    return (
      <div
        className={`skeleton rounded-lg ${className}`}
        style={{ width: width || "100%", height: height || "40px" }}
      />
    );
  }

  // Text variant
  if (lines === 1) {
    return (
      <div
        className={`skeleton rounded ${className}`}
        style={{ width: width || "100%", height: height || "14px" }}
      />
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton rounded"
          style={{
            width: i === lines - 1 ? "60%" : width || "100%",
            height: height || "14px",
          }}
        />
      ))}
    </div>
  );
}

// Composite presets

export function ConversationListSkeleton() {
  return (
    <div className="space-y-3 px-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <Skeleton variant="circle" width="16px" height="16px" />
          <Skeleton width={`${70 + (i % 3) * 10}%`} height="12px" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <Skeleton width="120px" height="24px" className="mb-2" />
      <Skeleton width="180px" height="14px" className="mb-6" />
      <Skeleton variant="rectangle" height="100px" className="mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rectangle" height="120px" />
        ))}
      </div>
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton variant="circle" width="18px" height="18px" />
          <Skeleton width={`${50 + (i % 4) * 10}%`} height="14px" />
          <Skeleton width="32px" height="18px" className="ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <Skeleton width="40%" height="16px" className="mb-3" />
      <Skeleton lines={3} />
    </div>
  );
}
