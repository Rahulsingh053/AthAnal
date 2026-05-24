import type { ReactNode } from "react";

import type { ProcessingStatus } from "@/lib/types";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200 ${className}`}
    />
  );
}

const STATUS_STYLES: Record<ProcessingStatus, string> = {
  pending: "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700",
  processing: "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-600",
  completed: "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600",
  failed: "bg-zinc-900 text-red-400 ring-1 ring-red-900/60",
};

export function StatusBadge({ status }: { status: ProcessingStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {(status === "pending" || status === "processing") && <Spinner className="h-3 w-3" />}
      {status}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function ProgressBar({
  value,
  label,
  className = "",
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className={className}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-300 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {(label || pct > 0) && (
        <p className="mt-1.5 text-xs text-zinc-400">
          {label ?? `${pct}%`}
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
