import type { Comparison, ComparisonReport, Sport, TryJobStatus, User, Video, VideoAnalytics } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:5678";

const TOKEN_KEY = "peakform_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) || res.statusText || "Request failed";
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

function uploadForm<T>(
  path: string,
  form: FormData,
  onUploadProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!onUploadProgress || !event.lengthComputable) return;
      onUploadProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      const text = xhr.responseText;
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        reject(new ApiError(xhr.status, "Invalid response from server"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
        return;
      }
      const detail =
        (data &&
          typeof data === "object" &&
          ("detail" in data || "message" in data) &&
          ((data as { detail?: string; message?: string }).detail ||
            (data as { detail?: string; message?: string }).message)) ||
        xhr.statusText ||
        "Upload failed";
      reject(
        new ApiError(
          xhr.status,
          typeof detail === "string" ? detail : JSON.stringify(detail),
        ),
      );
    };

    xhr.onerror = () => reject(new ApiError(0, "Network error during upload"));
    xhr.send(form);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type TryProgressUpdate = {
  phase: "upload" | "analysis";
  percent: number;
  message?: string;
};

export const api = {
  // Auth
  register: (body: { email: string; full_name: string; password: string }) =>
    request<{ access_token: string }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => request<User>("/api/v1/auth/me"),

  // Public (no auth)
  getTryJob: (jobId: string) => request<TryJobStatus>(`/api/v1/public/try/${jobId}`),
  tryComparison: async (
    form: FormData,
    onProgress?: (update: TryProgressUpdate) => void,
  ): Promise<ComparisonReport> => {
    const { job_id } = await uploadForm<{ job_id: string }>(
      "/api/v1/public/try",
      form,
      (pct) => onProgress?.({ phase: "upload", percent: pct, message: "Uploading videos…" }),
    );

    onProgress?.({
      phase: "analysis",
      percent: 2,
      message: "Upload complete — starting analysis…",
    });

    while (true) {
      const status = await request<TryJobStatus>(`/api/v1/public/try/${job_id}`);
      onProgress?.({
        phase: "analysis",
        percent: status.progress,
        message: status.message,
      });
      if (status.status === "completed" && status.report) {
        return status.report;
      }
      if (status.status === "failed") {
        throw new ApiError(422, status.error ?? "Analysis failed");
      }
      await sleep(800);
    }
  },

  // Sports
  listSports: () => request<Sport[]>("/api/v1/sports"),

  // Videos
  listVideos: () => request<Video[]>("/api/v1/videos"),
  getVideo: (id: number) => request<Video>(`/api/v1/videos/${id}`),
  uploadVideo: (form: FormData, onUploadProgress?: (percent: number) => void) =>
    uploadForm<Video>("/api/v1/videos", form, onUploadProgress),
  deleteVideo: (id: number) =>
    request<void>(`/api/v1/videos/${id}`, { method: "DELETE" }),
  getVideoAnalytics: (sportId?: number) =>
    request<VideoAnalytics[]>(`/api/v1/videos/analytics${sportId ? `?sport_id=${sportId}` : ""}`),

  // Comparisons
  listComparisons: () => request<Comparison[]>("/api/v1/comparisons"),
  getComparison: (id: number) => request<Comparison>(`/api/v1/comparisons/${id}`),
  createComparison: (body: {
    baseline_video_id: number;
    target_video_id: number;
    title?: string;
  }) =>
    request<Comparison>("/api/v1/comparisons", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
