"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ComparisonReport } from "@/components/ComparisonReport";
import { Card, ProgressBar, Spinner } from "@/components/ui";
import { api, ApiError, type TryProgressUpdate } from "@/lib/api";
import type { ComparisonReport as Report, Sport } from "@/lib/types";

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
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-zinc-100">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-200">
            ◆
          </span>
          <span className="text-gradient">PeakForm</span>
        </Link>
        <Link href="/register" className="btn-ghost py-1.5">
          Sign up to save analyses
        </Link>
      </div>

      <div className="mb-8 text-center">
        <span className="rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-400 backdrop-blur">
          Free preview · 1 comparison · no login
        </span>
        <h1 className="mt-4 text-3xl font-bold text-zinc-100">Try a movement comparison</h1>
        <p className="mt-2 text-zinc-400">
          Upload two clips — ball speed is detected automatically from your bowling action.
          Side-on, full-body framing works best.
        </p>
      </div>

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
                placeholder="Label (optional, e.g. slower spell)"
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
                placeholder="Label (optional, e.g. faster spell)"
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

        <div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Analysing…" : "Compare now"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      {loading && progress && (
        <Card className="mt-8 space-y-3">
          <div className="flex items-center gap-3">
            <Spinner />
            <p className="text-zinc-300">
              {progress.message ??
                (progress.phase === "upload"
                  ? "Uploading videos…"
                  : "Analysing both videos…")}
            </p>
          </div>
          <ProgressBar
            value={combinedProgress(progress)}
            label={`${combinedProgress(progress)}% complete`}
          />
          {progress.phase === "analysis" && (
            <p className="text-xs text-zinc-500">
              Both videos are analysed in parallel. Ball speed is estimated from your action.
            </p>
          )}
        </Card>
      )}

      {report && (
        <div ref={reportRef} className="mt-10">
          <h2 className="mb-4 text-2xl font-bold text-zinc-100">Your report</h2>
          <ComparisonReport report={report} />
          <Card className="mt-6 text-center">
            <p className="text-zinc-300">
              Want to save your analyses and compare over time?{" "}
              <Link href="/register" className="font-semibold text-zinc-100 hover:underline">
                Create a free account →
              </Link>
            </p>
          </Card>
        </div>
      )}
    </main>
  );
}
