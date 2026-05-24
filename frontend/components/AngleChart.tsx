"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Phase } from "@/lib/types";

export function AngleChart({
  title,
  timeline,
  baseline,
  target,
  baselineLabel,
  targetLabel,
  phases,
}: {
  title: string;
  timeline: number[];
  baseline: number[];
  target: number[];
  baselineLabel: string;
  targetLabel: string;
  phases?: Phase[];
}) {
  const data = timeline.map((t, i) => ({
    t,
    baseline: baseline[i],
    target: target[i],
  }));

  return (
    <div className="card">
      <h4 className="mb-3 text-sm font-semibold text-zinc-300">{title}</h4>
      {phases && phases.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
          {phases.map((p) => (
            <span key={p.name} className="flex items-center gap-1 text-xs text-zinc-500">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: p.color, opacity: 0.7 }}
              />
              {p.label}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
          {phases &&
            phases.map((p) => (
              <ReferenceArea
                key={p.name}
                x1={p.start_pct}
                x2={p.end_pct}
                fill={p.color}
                fillOpacity={0.07}
                strokeOpacity={0}
              />
            ))}
          <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis tick={{ fontSize: 11, fill: "#71717a" }} unit="°" width={48} />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 12,
              boxShadow: "0 8px 24px -12px rgba(0,0,0,0.6)",
              fontSize: 12,
              color: "#d4d4d8",
            }}
            labelFormatter={(v) => `Timeline ${v}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
          <Line
            type="monotone"
            dataKey="baseline"
            name={baselineLabel}
            stroke="#71717a"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="target"
            name={targetLabel}
            stroke="#e4e4e7"
            dot={false}
            strokeWidth={2.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
