"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ComparisonReport } from "@/components/ComparisonReport";
import { NavBar } from "@/components/NavBar";
import { Card, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import type { Comparison } from "@/lib/types";

export default function ComparisonPage() {
  const { user, loading } = useRequireAuth();
  const params = useParams();
  const id = Number(params.id);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchComparison = useCallback(async () => {
    try {
      setComparison(await api.getComparison(id));
    } catch {
      setError("Could not load this comparison.");
    }
  }, [id]);

  useEffect(() => {
    if (user) void fetchComparison();
  }, [user, fetchComparison]);

  useEffect(() => {
    const busy =
      comparison?.status === "pending" || comparison?.status === "processing";
    if (busy && !timer.current) {
      timer.current = setInterval(() => void fetchComparison(), 3000);
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
  }, [comparison, fetchComparison]);

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
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Back to dashboard
        </Link>

        {error && <Card><p className="text-red-400">{error}</p></Card>}

        {!comparison && !error && (
          <div className="flex justify-center py-20">
            <Spinner className="h-6 w-6" />
          </div>
        )}

        {comparison && (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-zinc-100">{comparison.title}</h1>
              <StatusBadge status={comparison.status} />
            </div>

            {comparison.status === "failed" && (
              <Card>
                <p className="text-red-400">
                  Analysis failed: {comparison.error_message ?? "unknown error"}
                </p>
              </Card>
            )}

            {(comparison.status === "pending" || comparison.status === "processing") && (
              <Card className="flex items-center gap-3">
                <Spinner />
                <p className="text-zinc-300">
                  Analysing both performances and comparing movement… this updates automatically.
                </p>
              </Card>
            )}

            {comparison.status === "completed" && comparison.report && (
              <ComparisonReport report={comparison.report} />
            )}
          </>
        )}
      </main>
    </>
  );
}
