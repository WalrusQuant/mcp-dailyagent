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
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4" style={{ color: color || "var(--text-muted)" }} />}
      </div>
      <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      {trend && (
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {trend}
        </div>
      )}
    </div>
  );
}
