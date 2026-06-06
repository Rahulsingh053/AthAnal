"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// BlazePose landmark indices we use for angle calculations
// (matches backend app/analysis/landmarks.py)
const ANGLE_DEFS: Record<string, [number, number, number]> = {
  "Right Elbow":    [12, 14, 16],
  "Left Elbow":     [11, 13, 15],
  "Right Shoulder": [24, 12, 14],
  "Left Shoulder":  [23, 11, 13],
  "Right Knee":     [24, 26, 28],
  "Left Knee":      [23, 25, 27],
  "Right Hip":      [12, 24, 26],
  "Left Hip":       [11, 23, 25],
};

// Skeleton connections for drawing
const CONNECTIONS: [number, number][] = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [15, 17], [16, 18],
];

// Optimal ranges per sport: [lo, hi, hint]
const SPORT_OPTIMAL: Record<string, Record<string, [number, number, string]>> = {
  bowling: {
    "Right Elbow":    [155, 180, "Arm extension at release"],
    "Left Elbow":     [80,  130, "Front arm cocked for counter-rotation"],
    "Left Knee":      [150, 180, "Front leg brace for pace"],
    "Right Knee":     [130, 175, "Back knee drive through delivery"],
    "Left Shoulder":  [82,  132, "High front arm for shoulder rotation"],
    "Right Shoulder": [82,  132, "Bowling arm shoulder plane"],
  },
  generic: {
    "Right Elbow":    [85,  165, "Elbow in athletic range"],
    "Left Elbow":     [85,  165, "Elbow in athletic range"],
    "Right Knee":     [95,  175, "Knee for power production"],
    "Left Knee":      [95,  175, "Knee for power production"],
    "Right Shoulder": [70,  160, "Shoulder range"],
    "Left Shoulder":  [70,  160, "Shoulder range"],
  },
};

type Landmark = { x: number; y: number; z: number; visibility?: number };

function calcAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.sqrt((abx * abx + aby * aby) * (cbx * cbx + cby * cby));
  if (mag === 0) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
}

function angleStatus(name: string, value: number, analyzerKey: string): "good" | "warn" | "bad" {
  const optimal = SPORT_OPTIMAL[analyzerKey]?.[name];
  if (!optimal) return "good";
  const [lo, hi] = optimal;
  if (value >= lo && value <= hi) return "good";
  const mid = (lo + hi) / 2;
  const range = hi - lo;
  if (Math.abs(value - mid) < range) return "warn";
  return "bad";
}

const STATUS_COLORS = {
  good: "#34d399",  // emerald-400
  warn: "#fbbf24",  // amber-400
  bad:  "#f87171",  // red-400
};

const STATUS_TEXT = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad:  "text-red-400",
};

export function LivePoseAnalyzer({ analyzerKey = "bowling" }: { analyzerKey?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [angles, setAngles] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poseLandmarkerRef = useRef<any>(null);
  const animRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const drawPose = useCallback((landmarks: Landmark[], w: number, h: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(228,228,231,0.6)";
    ctx.lineWidth = 2;
    for (const [a, b] of CONNECTIONS) {
      if (!landmarks[a] || !landmarks[b]) continue;
      ctx.beginPath();
      ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
      ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
      ctx.stroke();
    }

    for (const lm of landmarks) {
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#a78bfa";
      ctx.fill();
    }

    // Draw angle labels at joint vertices
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    for (const [name, [, b]] of Object.entries(ANGLE_DEFS)) {
      const lm = landmarks[b];
      if (!lm) continue;
      const val = angles[name];
      if (val === undefined) continue;
      const status = angleStatus(name, val, analyzerKey);
      ctx.fillStyle = STATUS_COLORS[status];
      ctx.fillText(`${Math.round(val)}°`, lm.x * w, lm.y * h - 8);
    }
  }, [angles, analyzerKey]);

  const detectLoop = useCallback(() => {
    if (!activeRef.current) return;
    const video = videoRef.current;
    const poseLandmarker = poseLandmarkerRef.current;
    if (!video || !poseLandmarker || video.readyState < 2) {
      animRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    try {
      const result = poseLandmarker.detectForVideo(video, performance.now());
      if (result.landmarks && result.landmarks.length > 0) {
        const lm: Landmark[] = result.landmarks[0];
        const newAngles: Record<string, number> = {};
        for (const [name, [a, b, c]] of Object.entries(ANGLE_DEFS)) {
          if (lm[a] && lm[b] && lm[c]) {
            newAngles[name] = calcAngle(lm[a], lm[b], lm[c]);
          }
        }
        setAngles(newAngles);
        drawPose(lm, video.videoWidth || 640, video.videoHeight || 480);
      }
    } catch {
      // Skip frame on error
    }

    animRef.current = requestAnimationFrame(detectLoop);
  }, [drawPose]);

  async function handleStart() {
    setError(null);
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      // Dynamically import MediaPipe tasks-vision
      const vision = await import("@mediapipe/tasks-vision");
      const { PoseLandmarker, FilesetResolver } = vision;
      const resolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      activeRef.current = true;
      setActive(true);
      detectLoop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setError("Camera access denied. Please allow camera access in your browser settings.");
      } else {
        setError(`Failed to start live analysis: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleStop() {
    activeRef.current = false;
    setActive(false);
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setAngles({});
  }

  useEffect(() => () => { handleStop(); }, []);

  const optimal = SPORT_OPTIMAL[analyzerKey] ?? {};
  const sortedAngles = Object.entries(angles).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      {/* Camera feed + skeleton overlay */}
      <div className="relative overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800">
        <video
          ref={videoRef}
          className="w-full"
          playsInline
          muted
          style={{ display: active ? "block" : "none" }}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ display: active ? "block" : "none" }}
        />
        {!active && (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <p className="text-4xl">📷</p>
            <p className="text-sm text-zinc-400">Live pose analysis via webcam</p>
            <p className="text-xs text-zinc-600">Loads MediaPipe on first start (~5 s)</p>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-950/30 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        {!active ? (
          <button
            className="btn-primary"
            onClick={() => void handleStart()}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-100" />
                Loading model…
              </span>
            ) : (
              "Start live analysis"
            )}
          </button>
        ) : (
          <button className="btn-ghost" onClick={handleStop}>
            Stop camera
          </button>
        )}
        <span className="text-xs text-zinc-600">
          Sport: <span className="text-zinc-400 capitalize">{analyzerKey}</span>
        </span>
      </div>

      {/* Real-time angle readouts */}
      {active && sortedAngles.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Live joint angles
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sortedAngles.map(([name, value]) => {
              const status = angleStatus(name, value, analyzerKey);
              const range = optimal[name];
              return (
                <div
                  key={name}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-center"
                >
                  <p className="text-xs text-zinc-500">{name}</p>
                  <p className={`text-2xl font-bold ${STATUS_TEXT[status]}`}>
                    {Math.round(value)}°
                  </p>
                  {range && (
                    <p className="mt-0.5 text-xs text-zinc-600">
                      Aim {range[0]}–{range[1]}°
                    </p>
                  )}
                  <p
                    className={`mt-0.5 text-xs font-medium ${STATUS_TEXT[status]}`}
                  >
                    {status === "good" ? "✓ Good" : status === "warn" ? "~ Close" : "✗ Off"}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="mt-2 flex gap-4 text-xs text-zinc-600">
            <span className="text-emerald-400">● In optimal range</span>
            <span className="text-amber-400">● Near range</span>
            <span className="text-red-400">● Outside range</span>
          </div>
        </div>
      )}

      {/* Hints for sport-specific joints */}
      {active && Object.keys(optimal).length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="mb-2 text-xs font-semibold text-zinc-400">Key focus points</p>
          <ul className="space-y-1">
            {Object.entries(optimal).map(([name, [lo, hi, hint]]) => (
              <li key={name} className="flex items-start gap-2 text-xs text-zinc-500">
                <span className="mt-0.5 shrink-0 text-zinc-600">▹</span>
                <span>
                  <span className="text-zinc-400">{name}</span> ({lo}–{hi}°): {hint}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
