"use client";

import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  color?: string;
}

export function StatCard({ label, value, icon: Icon, trend, color }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1.5">
        <span className="caption font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        {Icon && (
          <Icon
            className="w-4 h-4"
            style={{ color: color || "var(--text-muted)" }}
          />
        )}
      </div>
      <div
        className="text-2xl font-semibold tracking-tight tabular-nums"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
      {trend && (
        <div className="caption mt-1.5" style={{ color: "var(--text-muted)" }}>
          {trend}
        </div>
      )}
    </div>
  );
}
