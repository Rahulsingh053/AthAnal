"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LivePoseAnalyzer } from "@/components/LivePoseAnalyzer";
import { NavBar } from "@/components/NavBar";
import { NewComparisonForm } from "@/components/NewComparisonForm";
import { ProgressChart } from "@/components/ProgressChart";
import { VideoUploadForm } from "@/components/VideoUploadForm";
import { Card, ProgressBar, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import type { Comparison, Sport, Video, VideoAnalytics } from "@/lib/types";

function estimatedSpeedKph(video: Video): number | null {
  const extra = video.analysis_summary?.extra as
    | { estimated_speed?: { est_release_speed_kph?: number } }
    | undefined;
  const kph = extra?.estimated_speed?.est_release_speed_kph;
  return typeof kph === "number" ? kph : null;
}

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const [sports, setSports] = useState<Sport[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [analytics, setAnalytics] = useState<VideoAnalytics[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "progress" | "live">("overview");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine current sport for live analyzer (default to bowling if present)
  const primarySport = sports.find((s) => s.analyzer_key === "bowling") ?? sports[0];

  const refresh = useCallback(async () => {
    const [v, c] = await Promise.all([api.listVideos(), api.listComparisons()]);
    setVideos(v);
    setComparisons(c);
  }, []);

  const refreshAnalytics = useCallback(async () => {
    try {
      const data = await api.getVideoAnalytics();
      setAnalytics(data);
    } catch {
      // analytics are best-effort
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void api.listSports().then(setSports);
    void refresh();
    void refreshAnalytics();
  }, [user, refresh, refreshAnalytics]);

  useEffect(() => {
    if (activeTab === "progress") void refreshAnalytics();
  }, [activeTab, refreshAnalytics]);

  // Poll while anything is still processing.
  useEffect(() => {
    const busy =
      videos.some((v) => v.status === "pending" || v.status === "processing") ||
      comparisons.some((c) => c.status === "pending" || c.status === "processing");
    if (busy && !timer.current) {
      timer.current = setInterval(() => void refresh(), 1500);
    } else if (!busy && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [videos, comparisons, refresh]);

  async function onDelete(id: number) {
    await api.deleteVideo(id);
    void refresh();
    void refreshAnalytics();
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Your training analysis</h1>
          <p className="text-zinc-400">
            Upload performances, compare movements, track progress, and get AI coaching.
          </p>
        </div>

        {/* ── Tab navigation ──────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
          {(
            [
              { key: "overview", label: "Overview" },
              { key: "progress", label: "Progress tracking" },
              { key: "live",     label: "Live feedback" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeTab === key
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Tab: Overview
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h2 className="mb-4 text-lg font-semibold text-zinc-100">Upload a performance</h2>
                <VideoUploadForm sports={sports} onUploaded={refresh} />
              </Card>
              <Card>
                <h2 className="mb-4 text-lg font-semibold text-zinc-100">Create a comparison</h2>
                <NewComparisonForm videos={videos} />
              </Card>
            </div>

            {/* Videos list */}
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-zinc-100">Your videos</h2>
              {videos.length === 0 ? (
                <p className="text-sm text-zinc-400">No videos yet. Upload one above.</p>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {videos.map((v) => (
                    <div key={v.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="font-medium text-zinc-200">{v.label || v.original_filename}</p>
                          <p className="text-xs text-zinc-500">
                            {v.sport?.name}
                            {v.status === "completed" && estimatedSpeedKph(v) != null &&
                              ` · ~${estimatedSpeedKph(v)} kph (est.)`}
                            {v.duration_seconds != null && ` · ${v.duration_seconds}s`}
                          </p>
                          {v.status === "failed" && v.error_message && (
                            <p className="mt-1 text-xs text-red-400">{v.error_message}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <StatusBadge status={v.status} />
                          <button
                            onClick={() => onDelete(v.id)}
                            className="text-xs text-zinc-500 hover:text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {(v.status === "pending" || v.status === "processing") && (
                        <div className="mt-2 max-w-md">
                          <ProgressBar
                            value={v.analysis_progress ?? 0}
                            label={
                              v.status === "pending"
                                ? "Queued for analysis…"
                                : `Analysing… ${v.analysis_progress ?? 0}%`
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Comparisons list */}
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-zinc-100">Your comparisons</h2>
              {comparisons.length === 0 ? (
                <p className="text-sm text-zinc-400">No comparisons yet.</p>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {comparisons.map((c) => (
                    <Link
                      key={c.id}
                      href={`/comparisons/${c.id}`}
                      className="flex items-center justify-between py-3 hover:opacity-80"
                    >
                      <div>
                        <p className="font-medium text-zinc-200">{c.title}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(c.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.status === "completed" && c.report && (
                          <span className="text-sm font-semibold text-zinc-200">
                            {c.report.summary.similarity_score}%
                          </span>
                        )}
                        <StatusBadge status={c.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────
            Tab: Progress Tracking
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "progress" && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">Progress over time</h2>
                <p className="text-sm text-zinc-400">
                  Joint angle trends across all your completed sessions.
                </p>
              </div>
              <button
                onClick={() => void refreshAnalytics()}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Refresh
              </button>
            </div>

            {analytics.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-zinc-400">No completed videos yet.</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Upload and analyse at least 2 performances to see your progress chart.
                </p>
              </div>
            ) : (
              <>
                <ProgressChart data={analytics} />

                {/* Summary stats */}
                {analytics.length >= 2 && (
                  <div className="mt-6">
                    <p className="mb-3 text-sm font-semibold text-zinc-300">Session history</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-500">
                        <thead>
                          <tr className="border-b border-zinc-800">
                            <th className="py-1.5 pr-4">#</th>
                            <th className="py-1.5 pr-4">Label</th>
                            <th className="py-1.5 pr-4">Sport</th>
                            <th className="py-1.5 pr-4">Date</th>
                            <th className="py-1.5 pr-4">Metric</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.map((a, i) => (
                            <tr key={a.id} className="border-b border-zinc-900">
                              <td className="py-1.5 pr-4 text-zinc-600">{i + 1}</td>
                              <td className="py-1.5 pr-4 font-medium text-zinc-300">{a.label}</td>
                              <td className="py-1.5 pr-4">{a.sport ?? "–"}</td>
                              <td className="py-1.5 pr-4">
                                {new Date(a.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-1.5 pr-4">
                                {a.metric_value != null
                                  ? `${a.metric_value} ${a.metric_unit ?? ""}`
                                  : "–"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* ─────────────────────────────────────────────────────────────
            Tab: Live feedback
        ───────────────────────────────────────────────────────────── */}
        {activeTab === "live" && (
          <Card>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">Live pose feedback</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Real-time joint angle analysis via your webcam using MediaPipe AI.
                Colour-coded feedback shows whether each joint is in the optimal range for{" "}
                <span className="text-zinc-300">{primarySport?.name ?? "your sport"}</span>.
              </p>
            </div>

            {/* Sport selector */}
            {sports.length > 1 && (
              <div className="mb-4">
                <label className="label">Reference sport</label>
                <div className="flex gap-2">
                  {sports.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <LivePoseAnalyzer analyzerKey={primarySport?.analyzer_key ?? "generic"} />

            <p className="mt-4 text-xs text-zinc-600">
              Video is processed entirely in your browser — no frames are sent to any server.
              Requires camera permission and a modern browser with WebGL support.
            </p>
          </Card>
        )}
      </main>
    </>
  );
}
