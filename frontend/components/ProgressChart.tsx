"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VideoAnalytics } from "@/lib/types";

const TRACKED_JOINTS: Record<string, string> = {
  right_elbow:    "Right Elbow",
  left_elbow:     "Left Elbow",
  right_knee:     "Right Knee",
  left_knee:      "Left Knee",
  right_shoulder: "Right Shoulder",
  left_shoulder:  "Left Shoulder",
  trunk_lean:     "Trunk Lean",
};

const JOINT_COLORS: Record<string, string> = {
  right_elbow:    "#818cf8",
  left_elbow:     "#a78bfa",
  right_knee:     "#34d399",
  left_knee:      "#6ee7b7",
  right_shoulder: "#f59e0b",
  left_shoulder:  "#fcd34d",
  trunk_lean:     "#f87171",
};

export function ProgressChart({ data }: { data: VideoAnalytics[] }) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-zinc-400">
        Upload at least 2 completed videos to see your progress chart.
      </p>
    );
  }

  // Determine which joints have data
  const availableJoints = Object.keys(TRACKED_JOINTS).filter((j) =>
    data.some((d) => d.mean_angles[j] !== undefined)
  );

  const chartData = data.map((d, i) => {
    const point: Record<string, number | string> = {
      session: d.label.length > 14 ? d.label.slice(0, 14) + "…" : d.label,
      idx: i + 1,
    };
    for (const joint of availableJoints) {
      const val = d.mean_angles[joint];
      if (val !== undefined) point[joint] = Math.round(val * 10) / 10;
    }
    if (d.metric_value !== null) {
      point["__metric__"] = d.metric_value;
    }
    return point;
  });

  const hasMetric = data.some((d) => d.metric_value !== null);
  const metricUnit = data.find((d) => d.metric_unit)?.metric_unit ?? "";

  return (
    <div className="space-y-6">
      {/* Joint angle trends */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-zinc-300">Mean joint angles over time</h4>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -15, bottom: 0 }}>
            <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
            <XAxis
              dataKey="session"
              tick={{ fontSize: 11, fill: "#71717a" }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={48}
            />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} unit="°" width={48} />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 12,
                fontSize: 12,
                color: "#d4d4d8",
              }}
              formatter={(value: number, name: string) => [
                `${value}°`,
                TRACKED_JOINTS[name] ?? name,
              ]}
            />
            <Legend
              formatter={(name) => TRACKED_JOINTS[name] ?? name}
              wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
            />
            {availableJoints.map((joint) => (
              <Line
                key={joint}
                type="monotone"
                dataKey={joint}
                name={joint}
                stroke={JOINT_COLORS[joint] ?? "#71717a"}
                dot={{ r: 4, strokeWidth: 0 }}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Performance metric trend (if athlete supplied it) */}
      {hasMetric && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-zinc-300">
            Performance metric over time{metricUnit ? ` (${metricUnit})` : ""}
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -15, bottom: 0 }}>
              <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
              <XAxis
                dataKey="session"
                tick={{ fontSize: 11, fill: "#71717a" }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#71717a" }}
                unit={metricUnit ? ` ${metricUnit}` : ""}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#d4d4d8",
                }}
                formatter={(value: number) => [`${value} ${metricUnit}`, "Performance"]}
              />
              <Line
                type="monotone"
                dataKey="__metric__"
                name="Performance"
                stroke="#e4e4e7"
                dot={{ r: 5, fill: "#e4e4e7", strokeWidth: 0 }}
                strokeWidth={2.5}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
