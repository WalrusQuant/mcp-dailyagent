"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useThemeColors } from "@/lib/theme-colors";

interface DailyCost {
  date: string;
  promptTokens: number;
  completionTokens: number;
}

interface TokenChartProps {
  data: DailyCost[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
}

export function TokenChart({ data }: TokenChartProps) {
  const colors = useThemeColors();

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
        Token Usage
      </h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
              tickFormatter={formatTokens}
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
              formatter={(value, name) => [
                formatTokens(Number(value)),
                name === "promptTokens" ? "Prompt" : "Completion",
              ]}
              labelFormatter={(label) => {
                const d = new Date(label + "T00:00:00");
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
            />
            <Legend
              formatter={(value) => (value === "promptTokens" ? "Prompt" : "Completion")}
              wrapperStyle={{ fontSize: 12, color: colors.textSecondary }}
            />
            <Bar dataKey="promptTokens" stackId="tokens" fill={colors.accent} radius={[0, 0, 0, 0]} />
            <Bar dataKey="completionTokens" stackId="tokens" fill="#7c9eb2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
