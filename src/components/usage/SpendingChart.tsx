"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useThemeColors } from "@/lib/theme-colors";

interface DailyCost {
  date: string;
  cost: number;
  messages: number;
}

interface SpendingChartProps {
  data: DailyCost[];
}

export function SpendingChart({ data }: SpendingChartProps) {
  const colors = useThemeColors();

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
        Spending Over Time
      </h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.borderDefault} />
            <XAxis
              dataKey="date"
              tick={{ fill: colors.textMuted, fontSize: 11 }}
              tickFormatter={(v) => {
                const d = new Date(v + "T00:00:00");
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              stroke={colors.borderDefault}
            />
            <YAxis
              tick={{ fill: colors.textMuted, fontSize: 11 }}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              stroke={colors.borderDefault}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: colors.bgElevated,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: "8px",
                color: colors.textPrimary,
                fontSize: 12,
              }}
              formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
              labelFormatter={(label) => {
                const d = new Date(label + "T00:00:00");
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              }}
            />
            <Line
              type="monotone"
              dataKey="cost"
              stroke={colors.accent}
              strokeWidth={2}
              dot={data.length <= 14}
              activeDot={{ r: 4, fill: colors.accent }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
