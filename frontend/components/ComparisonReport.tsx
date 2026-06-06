"use client";

import type { AiDrill, ComparisonReport as Report, InjuryRisk, ProComparison } from "@/lib/types";
import { AngleChart } from "./AngleChart";
import { BallSpeedCard } from "./BallSpeedCard";
import { Card } from "./ui";

// ── helpers ───────────────────────────────────────────────────────────────

const EFFECT_STYLES: Record<string, string> = {
  increases: "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600",
  decreases: "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700",
  neutral:   "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700",
};
const EFFECT_LABEL: Record<string, string> = {
  increases: "▲ increases speed",
  decreases: "▼ decreases speed",
  neutral:   "– no real change",
};

const SEVERITY_BG: Record<string, string> = {
  high:   "border-red-800 bg-red-950/30",
  medium: "border-amber-800 bg-amber-950/20",
  low:    "border-zinc-700 bg-zinc-900",
};
const SEVERITY_BADGE: Record<string, string> = {
  high:   "bg-red-900 text-red-300",
  medium: "bg-amber-900 text-amber-300",
  low:    "bg-zinc-800 text-zinc-400",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:     "bg-emerald-900/40 text-emerald-300",
  intermediate: "bg-amber-900/40 text-amber-300",
  advanced:     "bg-red-900/40 text-red-300",
};

const PRO_STATUS_BADGE: Record<string, string> = {
  good:  "bg-emerald-900/40 text-emerald-300",
  below: "bg-amber-900/40 text-amber-300",
  above: "bg-amber-900/40 text-amber-300",
};
const PRO_STATUS_LABEL: Record<string, string> = {
  good:  "✓ In range",
  below: "↓ Below",
  above: "↑ Above",
};

// ── Section header chip ────────────────────────────────────────────────────

function SectionLabel({ icon, label, sub }: { icon: string; label: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <h3 className="text-lg font-semibold text-zinc-100">{label}</h3>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ComparisonReport({ report }: { report: Report }) {
  const {
    summary, insights, joint_differences, timing, key_events, angle_series,
    phases, injury_risks, pro_comparison, ai_coaching,
  } = report;
  const speed = report.speed_analysis;
  const baselineLabel = summary.baseline_label || "Baseline";
  const targetLabel   = summary.target_label   || "Target";
  const targetPhases  = phases?.target ?? [];

  return (
    <div className="space-y-6">

      {/* ── 🎯 Similarity score + headline ──────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">🎯 Similarity score</p>
          <p className="my-1 text-5xl font-extrabold text-gradient">
            {summary.similarity_score}
            <span className="text-2xl">%</span>
          </p>
          <p className="text-xs text-zinc-500">{summary.analyzer}</p>
        </Card>
        <Card className="lg:col-span-2 flex flex-col justify-center">
          <p className="text-lg font-semibold text-zinc-100">{summary.headline}</p>
          {summary.metric && (
            <p className="mt-2 text-sm text-zinc-400">
              Performance: {summary.metric.baseline} → {summary.metric.target}
              {summary.metric.unit ? ` ${summary.metric.unit}` : ""}
              <span className={`ml-2 font-semibold ${summary.metric.delta >= 0 ? "text-zinc-200" : "text-zinc-500"}`}>
                ({summary.metric.delta >= 0 ? "+" : ""}{summary.metric.delta})
              </span>
            </p>
          )}
        </Card>
      </div>

      {/* ── 🏏 Ball speed ────────────────────────────────────────────────── */}
      <BallSpeedCard report={report} />

      {/* ── 🏏 Speed analysis factors (bowling) ─────────────────────────── */}
      {speed && (
        <Card>
          <SectionLabel icon="🏏" label="Ball speed analysis" sub="estimated from video" />
          {speed.estimated && (
            <div className="mb-4 flex flex-wrap items-center gap-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <Metric label={`${baselineLabel} (est.)`} value={speed.estimated.baseline_kph} unit="kph" />
              <span className="text-2xl text-zinc-600">→</span>
              <Metric label={`${targetLabel} (est.)`} value={speed.estimated.target_kph} unit="kph" />
              <div className="ml-auto text-right">
                <p className="text-xs text-zinc-500">Estimated change</p>
                <p className={`text-xl font-bold ${speed.estimated.delta_kph >= 0 ? "text-zinc-100" : "text-zinc-400"}`}>
                  {speed.estimated.delta_kph >= 0 ? "+" : ""}{speed.estimated.delta_kph} kph
                </p>
              </div>
              <p className="w-full text-xs text-zinc-500">{speed.estimated.note}</p>
            </div>
          )}
          <h4 className="mb-2 text-sm font-semibold text-zinc-300">What changed your speed</h4>
          <div className="space-y-2">
            {speed.factors.map((f) => (
              <div key={f.key} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-zinc-100">{f.label}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EFFECT_STYLES[f.effect]}`}>
                    {EFFECT_LABEL[f.effect]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {f.baseline} → {f.target} {f.unit}
                  {f.change !== null && (
                    <span className="text-zinc-500"> ({f.change >= 0 ? "+" : ""}{f.change} {f.unit})</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{f.explanation}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 🤖 AI coaching narrative ─────────────────────────────────────── */}
      <Card className={ai_coaching?.narrative ? "border-indigo-800 bg-indigo-950/20" : ""}>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">🤖</span>
          <h3 className="text-lg font-semibold text-zinc-100">AI coaching narrative</h3>
          <span className="rounded-full bg-indigo-900 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
            ✦ AI Coach
          </span>
          <span className="text-xs text-zinc-500">powered by Claude</span>
        </div>
        {ai_coaching?.narrative ? (
          <p className="text-sm leading-relaxed text-zinc-200">{ai_coaching.narrative}</p>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-center">
            <p className="text-sm text-zinc-400">
              {ai_coaching?.error?.includes("not configured")
                ? "Add your ANTHROPIC_API_KEY to backend/.env to enable AI coaching reports."
                : "AI coaching report is being generated — refresh after a moment, or check your API key configuration."}
            </p>
          </div>
        )}
      </Card>

      {/* ── 🏋️ AI drill recommendations ──────────────────────────────────── */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">🏋️</span>
          <h3 className="text-lg font-semibold text-zinc-100">Recommended drills</h3>
          <span className="rounded-full bg-indigo-900 px-2 py-0.5 text-xs font-semibold text-indigo-300">AI</span>
        </div>
        {ai_coaching?.drills && ai_coaching.drills.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {ai_coaching.drills.map((drill, i) => (
              <DrillCard key={i} drill={drill} index={i + 1} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-center">
            <p className="text-sm text-zinc-400">
              Drill recommendations require a valid Anthropic API key in backend/.env
            </p>
          </div>
        )}
      </Card>

      {/* ── ⚠️ Injury risk flags ─────────────────────────────────────────── */}
      <Card>
        <SectionLabel
          icon="⚠️"
          label="Injury risk flags"
          sub="based on biomechanics literature · not a medical assessment"
        />
        {injury_risks && injury_risks.length > 0 ? (
          <div className="space-y-2">
            {injury_risks.map((r, i) => <InjuryRiskCard key={i} risk={r} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4">
            <p className="text-sm text-emerald-300">✓ No significant joint angle risks detected in this movement.</p>
          </div>
        )}
      </Card>

      {/* ── 🏆 Pro athlete comparison ─────────────────────────────────────── */}
      <Card>
        <SectionLabel icon="🏆" label="vs Professional benchmark" />
        <p className="mb-3 text-xs text-zinc-500">
          Comparing your target performance against elite athlete reference ranges from published biomechanics studies.
        </p>
        {pro_comparison && pro_comparison.length > 0 ? (
          <div className="divide-y divide-zinc-800">
            {pro_comparison.map((p) => <ProComparisonRow key={p.joint} item={p} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-center">
            <p className="text-sm text-zinc-400">Pro comparison data not available for this sport.</p>
          </div>
        )}
      </Card>

      {/* ── ⚡ Phase detection + Angle charts ─────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-base">⚡</span>
          <h3 className="text-lg font-semibold text-zinc-100">Joint angle over the movement</h3>
          {targetPhases.length > 0 ? (
            <span className="text-xs text-zinc-500">coloured regions = movement phases</span>
          ) : (
            <span className="text-xs text-zinc-600">phase detection not available</span>
          )}
        </div>
        {/* Phase legend */}
        {targetPhases.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {targetPhases.map((ph) => (
              <span
                key={ph.name}
                className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: ph.color }}
                />
                {ph.label}
              </span>
            ))}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(angle_series.channels).map(([channel, series]) => (
            <AngleChart
              key={channel}
              title={series.label}
              timeline={angle_series.timeline_pct}
              baseline={series.baseline}
              target={series.target}
              baselineLabel={baselineLabel}
              targetLabel={targetLabel}
              phases={targetPhases}
            />
          ))}
        </div>
      </div>

      {/* ── 📐 Joint-by-joint differences ────────────────────────────────── */}
      <Card>
        <SectionLabel icon="📐" label="Joint-by-joint differences" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="py-2 pr-4">Joint</th>
                <th className="py-2 pr-4">Avg ({baselineLabel})</th>
                <th className="py-2 pr-4">Avg ({targetLabel})</th>
                <th className="py-2 pr-4">Δ mean</th>
                <th className="py-2 pr-4">Δ range</th>
                <th className="py-2 pr-4">Avg difference</th>
              </tr>
            </thead>
            <tbody>
              {joint_differences.map((d) => (
                <tr key={d.channel} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 font-medium text-zinc-200">{d.label}</td>
                  <td className="py-2 pr-4 text-zinc-400">{d.baseline_mean}°</td>
                  <td className="py-2 pr-4 text-zinc-400">{d.target_mean}°</td>
                  <td className={`py-2 pr-4 ${d.mean_delta >= 0 ? "text-zinc-200" : "text-zinc-500"}`}>
                    {d.mean_delta >= 0 ? "+" : ""}{d.mean_delta}°
                  </td>
                  <td className="py-2 pr-4 text-zinc-400">{d.rom_delta >= 0 ? "+" : ""}{d.rom_delta}°</td>
                  <td className="py-2 pr-4 font-semibold text-zinc-100">{d.mean_abs_diff_deg}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Timing + key events ───────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-zinc-100">Timing</h3>
          <dl className="space-y-1 text-sm">
            <Row k={`${baselineLabel} duration`} v={`${timing.baseline_duration_s}s`} />
            <Row k={`${targetLabel} duration`}   v={`${timing.target_duration_s}s`} />
            {timing.tempo_change_pct !== null && (
              <Row k="Tempo change" v={`${timing.tempo_change_pct > 0 ? "+" : ""}${timing.tempo_change_pct}%`} />
            )}
          </dl>
        </Card>
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-zinc-100">Key event</h3>
          <dl className="space-y-1 text-sm">
            {key_events.baseline && (
              <Row
                k={`${baselineLabel}: ${key_events.baseline.label}`}
                v={key_events.baseline.time !== null ? `${key_events.baseline.time}s` : `frame ${key_events.baseline.frame}`}
              />
            )}
            {key_events.target && (
              <Row
                k={`${targetLabel}: ${key_events.target.label}`}
                v={key_events.target.time !== null ? `${key_events.target.time}s` : `frame ${key_events.target.frame}`}
              />
            )}
          </dl>
        </Card>
      </div>

      {/* ── Key insights ─────────────────────────────────────────────────── */}
      <Card>
        <h3 className="mb-3 text-lg font-semibold text-zinc-100">Key insights</h3>
        <ul className="space-y-2">
          {insights.map((line, i) => (
            <li key={i} className="flex gap-3 text-sm text-zinc-300">
              <span className="mt-0.5 text-zinc-500">▹</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Metric({ label, value, unit }: { label: string; value: number; unit: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-bold text-zinc-100">
        {value} <span className="text-sm font-normal text-zinc-500">{unit}</span>
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="font-medium text-zinc-200">{v}</dd>
    </div>
  );
}

function InjuryRiskCard({ risk }: { risk: InjuryRisk }) {
  return (
    <div className={`rounded-lg border p-3 ${SEVERITY_BG[risk.severity]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-zinc-100">{risk.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[risk.severity]}`}>
          {risk.severity} risk
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-300">{risk.message}</p>
      <p className="mt-1 text-xs text-zinc-500">
        Observed: {risk.observed_angle}° · Safe threshold: {risk.safe_threshold}° · Deviation: {risk.deviation_deg}°
      </p>
    </div>
  );
}

function DrillCard({ drill, index }: { drill: AiDrill; index: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-900 text-xs font-bold text-indigo-300">
            {index}
          </span>
          <p className="font-semibold text-zinc-100">{drill.title}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[drill.difficulty] ?? DIFFICULTY_COLORS.intermediate}`}>
          {drill.difficulty}
        </span>
      </div>
      <p className="text-sm text-zinc-400">{drill.description}</p>
      <p className="mt-2 text-xs text-zinc-600">
        Focus: <span className="text-zinc-500">{drill.focus_area}</span>
      </p>
    </div>
  );
}

function ProComparisonRow({ item }: { item: ProComparison }) {
  const scale = item.pro_range_high * 1.3 || 200;
  const barWidth = Math.min(100, (item.athlete_value / scale) * 100);
  const rangeLo  = Math.min(100, (item.pro_range_low  / scale) * 100);
  const rangeHi  = Math.min(100, (item.pro_range_high / scale) * 100);

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-200">{item.label}</p>
          <p className="text-xs text-zinc-500">{item.note}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-semibold text-zinc-100">{item.athlete_value}{item.unit}</span>
          <span className="text-xs text-zinc-500">
            Pro: {item.pro_range_low}–{item.pro_range_high}{item.unit}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRO_STATUS_BADGE[item.status]}`}>
            {PRO_STATUS_LABEL[item.status]}
          </span>
        </div>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="absolute top-0 h-full rounded-full bg-zinc-600 opacity-50"
          style={{ left: `${rangeLo}%`, width: `${rangeHi - rangeLo}%` }}
        />
        <div
          className={`absolute top-0 h-full w-1.5 rounded-full ${item.status === "good" ? "bg-emerald-400" : "bg-amber-400"}`}
          style={{ left: `${Math.min(98, barWidth)}%` }}
        />
      </div>
      {item.gap_deg > 0 && (
        <p className="mt-1 text-xs text-amber-500">{item.gap_deg}° outside pro range</p>
      )}
    </div>
  );
}
