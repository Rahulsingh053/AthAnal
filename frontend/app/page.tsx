"use client";

import Link from "next/link";

import { useAuth } from "@/lib/auth";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <div className="flex flex-col items-center text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs font-medium text-zinc-400 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          PeakForm · performance analysis
        </span>
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-zinc-100 sm:text-6xl">
          Compare two performances. <span className="text-gradient">See what changed.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
          Upload two videos of yourself - like a delivery at 124 kph and one at 140 kph -
          and PeakForm breaks down exactly how your body movement differed, then turns it into a
          report you can train from.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/try" className="btn-primary">
                Try it free - no login
              </Link>
              <Link href="/register" className="btn-ghost">
                Get started
              </Link>
              <Link href="/login" className="btn-ghost">
                Log in
              </Link>
            </>
          )}
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["1. Upload", "Add two videos of the same movement, with optional metrics like ball speed."],
            ["2. Analyse", "Pose estimation extracts joint angles and timing from every frame."],
            ["3. Improve", "Get a side-by-side report of joint differences, timing and coaching insights."],
          ].map(([title, body]) => (
            <div key={title} className="card transition hover:border-zinc-600 hover:shadow-glow">
              <h3 className="font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
