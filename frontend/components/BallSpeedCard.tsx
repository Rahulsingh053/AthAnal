"use client";

import type { ComparisonReport as Report } from "@/lib/types";
import { Card } from "./ui";

type SpeedSnapshot = {
  before: number;
  after: number;
  unit: string;
  beforeLabel: string;
  afterLabel: string;
  confidence: number | null;
};

function resolveEstimatedBallSpeed(report: Report): SpeedSnapshot | null {
  const estimated = report.speed_analysis?.estimated;
  if (estimated?.baseline_kph == null || estimated?.target_kph == null) {
    return null;
  }

  const { summary } = report;
  return {
    before: estimated.baseline_kph,
    after: estimated.target_kph,
    unit: "kph",
    beforeLabel: summary.baseline_label || "Before",
    afterLabel: summary.target_label || "After",
    confidence: estimated.confidence ?? null,
  };
}

export function BallSpeedCard({ report }: { report: Report }) {
  const speed = resolveEstimatedBallSpeed(report);
  const isBowling = summaryIsBowling(report);

  if (!speed) {
    if (!isBowling) return null;
    return (
      <Card className="border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Ball speed tracker
        </p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-100">Estimated pace</h3>
        <p className="mt-3 text-sm text-zinc-400">
          Could not estimate ball speed from these videos. Use a side-on, full-body clip with
          clear visibility of your bowling arm at release.
        </p>
      </Card>
    );
  }

  const delta = Math.round((speed.after - speed.before) * 10) / 10;
  const improved = delta > 0;
  const unchanged = delta === 0;
  const lowConfidence = speed.confidence != null && speed.confidence < 0.5;

  return (
    <Card className="border-zinc-700 bg-gradient-to-br from-zinc-900/90 to-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Ball speed tracker
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-100">
            Before vs after pace
          </h3>
        </div>
        <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700">
          Auto-detected from video
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <SpeedBlock
          phase="Before"
          label={speed.beforeLabel}
          value={speed.before}
          unit={speed.unit}
        />
        <div className="hidden text-3xl text-zinc-600 sm:block">→</div>
        <SpeedBlock
          phase="After"
          label={speed.afterLabel}
          value={speed.after}
          unit={speed.unit}
          highlight
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
        <p className="text-sm text-zinc-400">Pace change</p>
        <p
          className={`text-2xl font-bold ${
            unchanged ? "text-zinc-300" : improved ? "text-zinc-100" : "text-zinc-400"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta} {speed.unit}
          {!unchanged && (
            <span className="ml-2 text-sm font-medium text-zinc-500">
              {improved ? "faster" : "slower"}
            </span>
          )}
        </p>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        Estimated from your bowling action at release (hand speed calibrated to body height).
        Useful for comparing clips — may differ from a speed gun by 10–20 kph.
      </p>
      {lowConfidence && (
        <p className="mt-2 text-xs text-amber-500/90">
          Low tracking confidence on one or both clips — treat these numbers as approximate.
        </p>
      )}
    </Card>
  );
}

function summaryIsBowling(report: Report): boolean {
  const analyzer = report.summary.analyzer?.toLowerCase() ?? "";
  return analyzer.includes("bowl");
}

function SpeedBlock({
  phase,
  label,
  value,
  unit,
  highlight = false,
}: {
  phase: string;
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 text-center sm:text-left ${
        highlight ? "border-zinc-600 bg-zinc-900/80" : "border-zinc-800 bg-zinc-950/50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{phase}</p>
      <p className="mt-1 truncate text-sm text-zinc-400">{label}</p>
      <p
        className={`mt-2 font-extrabold ${
          highlight ? "text-4xl text-gradient" : "text-3xl text-zinc-100"
        }`}
      >
        ~{value}
        <span className="ml-1 text-base font-semibold text-zinc-500">{unit}</span>
      </p>
    </div>
  );
}
