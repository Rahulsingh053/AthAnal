"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { Video } from "@/lib/types";

export function NewComparisonForm({ videos }: { videos: Video[] }) {
  const router = useRouter();
  const ready = videos.filter((v) => v.status === "completed");
  const [baselineId, setBaselineId] = useState<number | "">("");
  const [targetId, setTargetId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!baselineId || !targetId) {
      setError("Pick a baseline and a target video.");
      return;
    }
    setSubmitting(true);
    try {
      const comparison = await api.createComparison({
        baseline_video_id: Number(baselineId),
        target_video_id: Number(targetId),
        title,
      });
      router.push(`/comparisons/${comparison.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create comparison");
    } finally {
      setSubmitting(false);
    }
  }

  if (ready.length < 2) {
    return (
      <p className="text-sm text-zinc-400">
        You need at least two fully-analysed videos of the same sport to create a comparison.
      </p>
    );
  }

  const label = (v: Video) => `${v.label || v.original_filename} · ${v.sport?.name ?? ""}`;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Baseline (before)</label>
          <select className="input" value={baselineId}
            onChange={(e) => setBaselineId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Select…</option>
            {ready.map((v) => (
              <option key={v.id} value={v.id}>{label(v)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Target (after)</label>
          <select className="input" value={targetId}
            onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Select…</option>
            {ready.map((v) => (
              <option key={v.id} value={v.id}>{label(v)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Title (optional)</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="124 kph vs 140 kph" />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Compare"}
      </button>
    </form>
  );
}
