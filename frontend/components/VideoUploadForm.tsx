"use client";

import { useRef, useState } from "react";

import { ProgressBar } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Sport } from "@/lib/types";

export function VideoUploadForm({
  sports,
  onUploaded,
}: {
  sports: Sport[];
  onUploaded: () => void;
}) {
  const [sportId, setSportId] = useState<number | "">("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sportId || !file) {
      setError("Choose a sport and a video file.");
      return;
    }
    const form = new FormData();
    form.append("sport_id", String(sportId));
    form.append("label", label);
    form.append("file", file);

    setSubmitting(true);
    setUploadProgress(0);
    try {
      await api.uploadVideo(form, setUploadProgress);
      setLabel("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Sport</label>
          <select
            className="input"
            value={sportId}
            onChange={(e) => setSportId(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Select a sport…</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Label (optional)</label>
          <input
            className="input"
            placeholder="e.g. slower spell"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Video file</label>
        <input
          ref={fileRef}
          className="input"
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          For bowling, ball speed is estimated automatically after upload — no manual entry needed.
        </p>
      </div>

      {submitting && uploadProgress != null && (
        <ProgressBar
          value={uploadProgress}
          label={`Uploading… ${uploadProgress}%`}
        />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Uploading…" : "Upload & analyse"}
      </button>
    </form>
  );
}
