"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useThemeColors, CHART_COLORS } from "@/lib/theme-colors";

interface ModelData {
  model: string;
  modelName: string;
  cost: number;
  messages: number;
  promptTokens: number;
  completionTokens: number;
}

interface ModelBreakdownProps {
  data: ModelData[];
}

export function ModelBreakdown({ data }: ModelBreakdownProps) {
  const colors = useThemeColors();

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
        Cost by Model
      </h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.borderDefault} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: colors.textMuted, fontSize: 11 }}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              stroke={colors.borderDefault}
            />
            <YAxis
              type="category"
              dataKey="modelName"
              tick={{ fill: colors.textSecondary, fontSize: 11 }}
              stroke={colors.borderDefault}
              width={120}
            />
            <Tooltip
              contentStyle={{
                background: colors.bgElevated,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: "8px",
                color: colors.textPrimary,
                fontSize: 12,
              }}
              formatter={(value, _name, props) => {
                const item = props.payload as unknown as ModelData;
                const numVal = Number(value);
                return [
                  `$${numVal.toFixed(4)} (${item.messages} msgs)`,
                  "Cost",
                ];
              }}
            />
            <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
              {data.map((_entry, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
