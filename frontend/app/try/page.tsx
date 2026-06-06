"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ComparisonReport } from "@/components/ComparisonReport";
import { Card, ProgressBar, Spinner } from "@/components/ui";
import { api, ApiError, type TryProgressUpdate } from "@/lib/api";
import type { ComparisonReport as Report, Sport } from "@/lib/types";

const AI_FEATURES = [
  { icon: "🤖", label: "AI coaching narrative" },
  { icon: "🏋️", label: "3 targeted drills" },
  { icon: "⚡", label: "Phase detection" },
  { icon: "⚠️", label: "Injury risk flags" },
  { icon: "🏆", label: "Pro athlete comparison" },
  { icon: "📐", label: "Joint angle charts" },
  { icon: "🎯", label: "Similarity score" },
  { icon: "🏏", label: "Ball speed estimate" },
];

export default function TryPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [sportId, setSportId] = useState<number | "">("");
  const [baseline, setBaseline] = useState<File | null>(null);
  const [target, setTarget] = useState<File | null>(null);
  const [baselineLabel, setBaselineLabel] = useState("Before");
  const [targetLabel, setTargetLabel] = useState("After");

  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<TryProgressUpdate | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  function combinedProgress(update: TryProgressUpdate): number {
    if (update.phase === "upload") {
      return Math.round(update.percent * 0.2);
    }
    return Math.round(20 + update.percent * 0.8);
  }

  useEffect(() => {
    void api.listSports().then((s) => {
      setSports(s);
      const bowling = s.find((x) => x.analyzer_key === "bowling");
      if (bowling) setSportId(bowling.id);
    });
  }, []);

  useEffect(() => {
    if (report) reportRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [report]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    if (!baseline || !target) {
      setError("Please choose both videos.");
      return;
    }
    const form = new FormData();
    if (sportId) form.append("sport_id", String(sportId));
    form.append("baseline_label", baselineLabel || "Before");
    form.append("target_label", targetLabel || "After");
    form.append("baseline", baseline);
    form.append("target", target);

    setLoading(true);
    setProgress({ phase: "upload", percent: 0, message: "Uploading videos…" });
    try {
      setReport(
        await api.tryComparison(form, (update) => {
          setProgress(update);
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-zinc-100">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-200">
            ◆
          </span>
          <span className="text-gradient">PeakForm</span>
        </Link>
        <Link href="/register" className="btn-ghost py-1.5">
          Sign up free
        </Link>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="mb-10 text-center">
        <span className="rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-400 backdrop-blur">
          Free preview · no login required
        </span>
        <h1 className="mt-4 text-3xl font-bold text-zinc-100">
          AI-powered movement analysis
        </h1>
        <p className="mt-2 text-zinc-400">
          Upload two clips of the same movement. Our AI analyses your biomechanics,
          detects injury risks, compares you to professionals, and writes a personalised coaching report.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {AI_FEATURES.map((f) => (
            <span
              key={f.label}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300"
            >
              <span>{f.icon}</span>
              {f.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Upload form ─────────────────────────────────────────────── */}
      <form onSubmit={onSubmit} className="grid gap-6">
        <Card>
          <label className="label">Sport</label>
          <select
            className="input max-w-sm"
            value={sportId}
            onChange={(e) => setSportId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Auto (bowling)</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-semibold text-zinc-200">Baseline (before)</h3>
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Label (e.g. slower spell)"
                value={baselineLabel}
                onChange={(e) => setBaselineLabel(e.target.value)}
              />
              <input
                className="input"
                type="file"
                accept="video/*"
                onChange={(e) => setBaseline(e.target.files?.[0] ?? null)}
                required
              />
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 font-semibold text-zinc-200">Target (after)</h3>
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Label (e.g. faster spell)"
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
              />
              <input
                className="input"
                type="file"
                accept="video/*"
                onChange={(e) => setTarget(e.target.files?.[0] ?? null)}
                required
              />
            </div>
          </Card>
        </div>

        <p className="text-xs text-zinc-500">
          Side-on, full-body framing works best. MP4 / MOV / AVI accepted.
        </p>

        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Analysing…" : "Analyse with AI →"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      {/* ── Progress ────────────────────────────────────────────────── */}
      {loading && progress && (
        <Card className="mt-8 space-y-3">
          <div className="flex items-center gap-3">
            <Spinner />
            <p className="text-zinc-300">
              {progress.message ?? (progress.phase === "upload" ? "Uploading videos…" : "Analysing…")}
            </p>
          </div>
          <ProgressBar
            value={combinedProgress(progress)}
            label={`${combinedProgress(progress)}% complete`}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
            {combinedProgress(progress) > 20 && <span className="text-zinc-400">✓ Upload complete</span>}
            {combinedProgress(progress) > 50 && <span className="text-zinc-400">✓ Pose extraction</span>}
            {combinedProgress(progress) > 80 && <span className="text-zinc-400">✓ Movement comparison</span>}
            {combinedProgress(progress) > 94 && <span className="text-zinc-400">✓ Phase detection</span>}
            {combinedProgress(progress) > 96 && <span className="text-zinc-400">⟳ AI coaching report…</span>}
          </div>
        </Card>
      )}

      {/* ── Report ──────────────────────────────────────────────────── */}
      {report && (
        <div ref={reportRef} className="mt-10">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-2xl font-bold text-zinc-100">Your AI analysis report</h2>
            <span className="rounded-full border border-indigo-700 bg-indigo-950/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              ✦ AI powered
            </span>
          </div>

          <ComparisonReport report={report} />

          <Card className="mt-8 text-center">
            <p className="text-lg font-semibold text-zinc-100">
              Save your analyses and track progress over time
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Free account gives you unlimited comparisons, multi-session progress charts and live webcam feedback.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/register" className="btn-primary">
                Create free account →
              </Link>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
