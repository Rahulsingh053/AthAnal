"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type Landmark = { x: number; y: number; z: number; visibility?: number };
type Status = "good" | "warn" | "bad";

interface CoachingCue {
  joint: string;
  priority: number;
  lo: number;
  hi: number;
  tooLowMsg: string;
  tooHighMsg: string;
  holdMsg: string;
  achieveMsg: string;
  impactLabel: string;
  impactEmoji: string;
  holdFrames: number;
}

// ── BlazePose landmark indices ─────────────────────────────────────────────
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

const CONNECTIONS: [number, number][] = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [15, 17], [16, 18],
];

// ── Coaching database ──────────────────────────────────────────────────────
const SPORT_COACHING: Record<string, CoachingCue[]> = {
  bowling: [
    {
      joint: "Right Elbow",
      priority: 1,
      lo: 155, hi: 180,
      tooLowMsg: "Straighten your bowling arm — every degree of bend is pace you're leaving on the pitch",
      tooHighMsg: "Drive your arm through, keep extending at the crease",
      holdMsg: "Perfect arm extension — lock this in at release!",
      achieveMsg: "Arm extension locked! Full extension adds 4–6 kph at the crease",
      impactLabel: "+4–6 kph",
      impactEmoji: "⚡",
      holdFrames: 15,
    },
    {
      joint: "Left Elbow",
      priority: 2,
      lo: 80, hi: 130,
      tooLowMsg: "Cock your front arm tight — pull it close to your chest like a spring",
      tooHighMsg: "Bring your front elbow in — a wide arm bleeds rotational speed",
      holdMsg: "Front arm coiled perfectly — now whip it down hard at release!",
      achieveMsg: "Front arm perfect! Pulling it down hard rotates your shoulder 30% faster",
      impactLabel: "+30% shoulder rotation",
      impactEmoji: "🔄",
      holdFrames: 12,
    },
    {
      joint: "Left Knee",
      priority: 3,
      lo: 150, hi: 180,
      tooLowMsg: "Drive your front leg straighter — plant it like a spike into the crease, not a cushion",
      tooHighMsg: "Excellent front leg brace",
      holdMsg: "Front leg braced — you're standing on a concrete pillar of energy",
      achieveMsg: "Elite front knee brace! Converts all your run-up momentum directly into ball speed",
      impactLabel: "Full momentum transfer",
      impactEmoji: "🦵",
      holdFrames: 20,
    },
    {
      joint: "Right Knee",
      priority: 4,
      lo: 130, hi: 175,
      tooLowMsg: "Drive your back knee through the crease — explode off the back foot",
      tooHighMsg: "Good back leg — keep powering through",
      holdMsg: "Back leg driving through perfectly — hip power incoming!",
      achieveMsg: "Back knee drive is elite! This hip chain is what separates 120 from 140 kph bowlers",
      impactLabel: "Raw pace",
      impactEmoji: "💪",
      holdFrames: 15,
    },
    {
      joint: "Left Shoulder",
      priority: 5,
      lo: 82, hi: 132,
      tooLowMsg: "Raise your front arm high — point your elbow at mid-off",
      tooHighMsg: "Drop your front arm a little — aim it toward mid-off, not straight up",
      holdMsg: "Front shoulder aligned for full trunk rotation",
      achieveMsg: "Shoulder alignment spot on! Gives you maximum trunk rotation and swing potential",
      impactLabel: "Max swing + rotation",
      impactEmoji: "🏏",
      holdFrames: 12,
    },
    {
      joint: "Right Shoulder",
      priority: 6,
      lo: 82, hi: 132,
      tooLowMsg: "Bring your bowling shoulder higher in the delivery arc",
      tooHighMsg: "Lower your bowling shoulder slightly — stay on the right plane",
      holdMsg: "Bowling shoulder on the correct plane — consistent release incoming",
      achieveMsg: "Shoulder plane dialed! Same plane every ball = elite line, length and swing control",
      impactLabel: "Release consistency",
      impactEmoji: "🎯",
      holdFrames: 12,
    },
  ],
  generic: [
    {
      joint: "Right Knee",
      priority: 1,
      lo: 95, hi: 175,
      tooLowMsg: "Drive your right knee higher — knee lift is how elite athletes generate stride power",
      tooHighMsg: "Extend your right knee more at push-off — don't leave power in the hinge",
      holdMsg: "Right knee in elite power position!",
      achieveMsg: "Knee drive locked! Elite sprinters generate 40% of stride power from this position",
      impactLabel: "+40% stride power",
      impactEmoji: "⚡",
      holdFrames: 10,
    },
    {
      joint: "Left Knee",
      priority: 2,
      lo: 95, hi: 175,
      tooLowMsg: "Drive your left knee higher — match the power from your right side",
      tooHighMsg: "Extend your left knee more at push-off",
      holdMsg: "Left knee in great power position!",
      achieveMsg: "Both knees firing! Symmetrical drive = zero energy waste, maximum speed",
      impactLabel: "Zero energy waste",
      impactEmoji: "⚖️",
      holdFrames: 10,
    },
    {
      joint: "Right Elbow",
      priority: 3,
      lo: 85, hi: 165,
      tooLowMsg: "Drive your right arm harder — arm swing contributes 15% of your forward momentum",
      tooHighMsg: "Relax your right arm — a locked angle limits your swing arc",
      holdMsg: "Right arm driving at full power!",
      achieveMsg: "Right arm drive perfect! Arm swing contributes up to 15% of total sprint momentum",
      impactLabel: "+15% momentum",
      impactEmoji: "💪",
      holdFrames: 10,
    },
    {
      joint: "Left Elbow",
      priority: 4,
      lo: 85, hi: 165,
      tooLowMsg: "Drive your left arm to match your right — asymmetric arms bleed speed",
      tooHighMsg: "Relax your left arm angle — you're over-rotating the shoulder",
      holdMsg: "Both arms in perfect sync!",
      achieveMsg: "Arm symmetry dialed! Equal bilateral drive = straight running line and max velocity",
      impactLabel: "Straight line speed",
      impactEmoji: "🔄",
      holdFrames: 10,
    },
    {
      joint: "Right Hip",
      priority: 5,
      lo: 150, hi: 180,
      tooLowMsg: "Open your right hip fully — drive all the way through to complete extension",
      tooHighMsg: "Great hip extension — keep driving",
      holdMsg: "Full right hip extension — this is where real power lives",
      achieveMsg: "Hip extension maxed! Elite movers achieve 175°+ at push-off for peak power output",
      impactLabel: "Peak power output",
      impactEmoji: "🦵",
      holdFrames: 12,
    },
    {
      joint: "Left Hip",
      priority: 6,
      lo: 150, hi: 180,
      tooLowMsg: "Open your left hip — drive through to full extension like your right side",
      tooHighMsg: "Excellent left hip extension — keep driving",
      holdMsg: "Both hips at full extension — bilateral power!",
      achieveMsg: "Both hips firing at max extension! This is the hallmark of world-class athletes",
      impactLabel: "World-class power",
      impactEmoji: "🔥",
      holdFrames: 12,
    },
  ],
};

// ── Pure helpers ───────────────────────────────────────────────────────────
function calcAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.sqrt((abx * abx + aby * aby) * (cbx * cbx + cby * cby));
  if (mag === 0) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
}

function getStatus(val: number, lo: number, hi: number): Status {
  if (val >= lo && val <= hi) return "good";
  if (Math.abs(val - (lo + hi) / 2) < (hi - lo)) return "warn";
  return "bad";
}

function getActiveCue(angles: Record<string, number>, analyzerKey: string): CoachingCue | null {
  const cues = (SPORT_COACHING[analyzerKey] ?? SPORT_COACHING.generic).slice().sort((a, b) => a.priority - b.priority);
  for (const cue of cues) {
    const val = angles[cue.joint];
    if (val !== undefined && getStatus(val, cue.lo, cue.hi) !== "good") return cue;
  }
  return null;
}

function calcKineticScore(angles: Record<string, number>, analyzerKey: string): number {
  const cues = SPORT_COACHING[analyzerKey] ?? SPORT_COACHING.generic;
  let weighted = 0, total = 0;
  for (const cue of cues) {
    const val = angles[cue.joint];
    if (val === undefined) continue;
    total++;
    const s = getStatus(val, cue.lo, cue.hi);
    weighted += s === "good" ? 1 : s === "warn" ? 0.5 : 0;
  }
  return total === 0 ? 0 : Math.round((weighted / total) * 100);
}

// ── Canvas drawing ─────────────────────────────────────────────────────────
const CANVAS_COLORS: Record<Status, string> = {
  good: "#34d399",
  warn: "#fbbf24",
  bad:  "#f87171",
};

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, dir: "up" | "down", color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir === "up") {
    ctx.moveTo(x, y - 10); ctx.lineTo(x - 7, y); ctx.lineTo(x + 7, y);
  } else {
    ctx.moveTo(x, y + 10); ctx.lineTo(x - 7, y); ctx.lineTo(x + 7, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPoseCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  w: number,
  h: number,
  angles: Record<string, number>,
  analyzerKey: string,
  activeCue: CoachingCue | null,
  achievements: Set<string>,
  pulse: number,
) {
  ctx.clearRect(0, 0, w, h);

  const cues = SPORT_COACHING[analyzerKey] ?? SPORT_COACHING.generic;
  const cueMap = new Map(cues.map(c => [c.joint, c]));

  // 1 — Base skeleton
  ctx.strokeStyle = "rgba(228,228,231,0.4)";
  ctx.lineWidth = 2;
  for (const [a, b] of CONNECTIONS) {
    const la = landmarks[a], lb = landmarks[b];
    if (!la || !lb) continue;
    ctx.beginPath();
    ctx.moveTo(la.x * w, la.y * h);
    ctx.lineTo(lb.x * w, lb.y * h);
    ctx.stroke();
  }

  // 2 — Coached joint: highlight connected limbs + pulsing ring + arrow
  if (activeCue) {
    const def = ANGLE_DEFS[activeCue.joint];
    if (def) {
      const [, bIdx] = def;
      for (const [a, b] of CONNECTIONS) {
        if (a !== bIdx && b !== bIdx) continue;
        const la = landmarks[a], lb = landmarks[b];
        if (!la || !lb) continue;
        ctx.beginPath();
        ctx.moveTo(la.x * w, la.y * h);
        ctx.lineTo(lb.x * w, lb.y * h);
        ctx.strokeStyle = `rgba(251,191,36,${0.5 + pulse * 0.35})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.lineWidth = 2;

      const bLm = landmarks[bIdx];
      if (bLm) {
        const bx = bLm.x * w, by = bLm.y * h;

        // Outer pulsing ring
        ctx.beginPath();
        ctx.arc(bx, by, 16 + pulse * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(251,191,36,${0.65 - pulse * 0.45})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner solid ring
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Directional arrow above joint
        const val = angles[activeCue.joint] ?? 0;
        const dir = val < (activeCue.lo + activeCue.hi) / 2 ? "up" : "down";
        drawArrow(ctx, bx, by - 30, dir, "#fbbf24");

        // Target range arc (dashed, indigo)
        const [aIdx, , cIdx] = def;
        const aLm = landmarks[aIdx], cLm = landmarks[cIdx];
        if (aLm && cLm) {
          const ax = aLm.x * w - bx, ay = aLm.y * h - by;
          const refAngle = Math.atan2(ay, ax);
          const toRad = Math.PI / 180;
          ctx.beginPath();
          ctx.arc(bx, by, 38, refAngle - activeCue.hi * toRad, refAngle - activeCue.lo * toRad);
          ctx.strokeStyle = "rgba(99,102,241,0.75)";
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Small label "target"
          ctx.font = "9px monospace";
          ctx.fillStyle = "rgba(99,102,241,0.9)";
          ctx.textAlign = "center";
          ctx.fillText("target", bx + 50, by - 30);
        }
      }
    }
  }

  // 3 — Achievement glow on mastered joints
  for (const [name, [, bIdx]] of Object.entries(ANGLE_DEFS)) {
    if (!achievements.has(name)) continue;
    const lm = landmarks[bIdx];
    if (!lm) continue;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, 13, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(52,211,153,0.18)";
    ctx.fill();
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 4 — Landmark dots
  for (const lm of landmarks) {
    if (!lm) continue;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#a78bfa";
    ctx.fill();
  }

  // 5 — Angle labels with dark pill background
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  for (const [name, [, bIdx]] of Object.entries(ANGLE_DEFS)) {
    const lm = landmarks[bIdx];
    const val = angles[name];
    if (!lm || val === undefined) continue;
    const cue = cueMap.get(name);
    const status: Status = cue ? getStatus(val, cue.lo, cue.hi) : "good";
    const color = CANVAS_COLORS[status];
    const x = lm.x * w, y = lm.y * h - 18;
    const label = `${Math.round(val)}°`;
    const tw = ctx.measureText(label).width;

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(x - tw / 2 - 5, y - 12, tw + 10, 15);
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);

    if (achievements.has(name)) {
      ctx.fillStyle = "#34d399";
      ctx.font = "9px monospace";
      ctx.fillText("✓", x + tw / 2 + 8, y);
      ctx.font = "bold 11px monospace";
    }
  }
}

// ── CSS helpers ────────────────────────────────────────────────────────────
const STATUS_CSS: Record<Status, string> = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad:  "text-red-400",
};

// ── Component ──────────────────────────────────────────────────────────────
export function LivePoseAnalyzer({ analyzerKey = "bowling" }: { analyzerKey?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [active, setActive]               = useState(false);
  const [angles, setAngles]               = useState<Record<string, number>>({});
  const [error, setError]                 = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [kineticScore, setKineticScore]   = useState(0);
  const [activeCue, setActiveCue]         = useState<CoachingCue | null>(null);
  const [holdProgress, setHoldProgress]   = useState(0);
  const [achievements, setAchievements]   = useState<Set<string>>(new Set());
  const [celebCue, setCelebCue]           = useState<CoachingCue | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poseLandmarkerRef  = useRef<any>(null);
  const animRef            = useRef<number | null>(null);
  const activeRef          = useRef(false);
  const holdCountRef       = useRef(0);
  const activeCueRef       = useRef<CoachingCue | null>(null);
  const achievementsRef    = useRef<Set<string>>(new Set());
  const pulseRef           = useRef(0);
  const pulseDirRef        = useRef(1);

  // Pulse ticker (runs independently of detect loop)
  useEffect(() => {
    let raf: number;
    const tick = () => {
      pulseRef.current += 0.025 * pulseDirRef.current;
      if (pulseRef.current >= 1) { pulseRef.current = 1; pulseDirRef.current = -1; }
      if (pulseRef.current <= 0) { pulseRef.current = 0; pulseDirRef.current = 1; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const drawPose = useCallback((lm: Landmark[], w: number, h: number, ang: Record<string, number>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = w;
    canvas.height = h;
    drawPoseCanvas(ctx, lm, w, h, ang, analyzerKey, activeCueRef.current, achievementsRef.current, pulseRef.current);
  }, [analyzerKey]);

  const detectLoop = useCallback(() => {
    if (!activeRef.current) return;
    const video = videoRef.current;
    const pl = poseLandmarkerRef.current;
    if (!video || !pl || video.readyState < 2) {
      animRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    try {
      const result = pl.detectForVideo(video, performance.now());
      if (result.landmarks?.length > 0) {
        const lm: Landmark[] = result.landmarks[0];

        // Calc angles
        const ang: Record<string, number> = {};
        for (const [name, [a, b, c]] of Object.entries(ANGLE_DEFS)) {
          if (lm[a] && lm[b] && lm[c]) ang[name] = calcAngle(lm[a], lm[b], lm[c]);
        }

        // Coaching engine
        const cue   = getActiveCue(ang, analyzerKey);
        const score = calcKineticScore(ang, analyzerKey);
        activeCueRef.current = cue;

        // Hold detection & achievement unlock
        if (cue !== null) {
          const val = ang[cue.joint];
          if (val !== undefined && getStatus(val, cue.lo, cue.hi) === "good") {
            holdCountRef.current++;
          } else {
            holdCountRef.current = Math.max(0, holdCountRef.current - 1);
          }
          if (holdCountRef.current >= cue.holdFrames && !achievementsRef.current.has(cue.joint)) {
            achievementsRef.current = new Set([...achievementsRef.current, cue.joint]);
            setAchievements(new Set(achievementsRef.current));
            setCelebCue(cue);
            setTimeout(() => setCelebCue(null), 4500);
            holdCountRef.current = 0;
          }
        } else {
          holdCountRef.current = 0;
        }

        const hp = cue ? Math.min(100, (holdCountRef.current / cue.holdFrames) * 100) : 0;

        setAngles(ang);
        setKineticScore(score);
        setActiveCue(cue);
        setHoldProgress(hp);

        drawPose(lm, video.videoWidth || 640, video.videoHeight || 480, ang);
      }
    } catch { /* skip frame */ }

    animRef.current = requestAnimationFrame(detectLoop);
  }, [analyzerKey, drawPose]);

  async function handleStart() {
    setError(null);
    setLoading(true);
    setAchievements(new Set());
    achievementsRef.current = new Set();
    holdCountRef.current = 0;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const video = videoRef.current;
      if (video) { video.srcObject = stream; await video.play(); }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – types exist in vision.d.ts but package.json exports field blocks resolution
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
      setError(
        msg.includes("Permission") || msg.includes("NotAllowed")
          ? "Camera access denied. Please allow camera access in your browser settings."
          : `Failed to start: ${msg}`
      );
    } finally {
      setLoading(false);
    }
  }

  function handleStop() {
    activeRef.current = false;
    setActive(false);
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setAngles({});
    setKineticScore(0);
    setActiveCue(null);
    setHoldProgress(0);
    setCelebCue(null);
  }

  useEffect(() => () => { handleStop(); }, []);

  const cues        = SPORT_COACHING[analyzerKey] ?? SPORT_COACHING.generic;
  const hasAngles   = Object.keys(angles).length > 0;
  const allPerfect  = active && hasAngles && activeCue === null;
  const scoreColor  = kineticScore >= 80 ? "#34d399" : kineticScore >= 50 ? "#fbbf24" : "#f87171";
  const scoreCSS    = kineticScore >= 80 ? "text-emerald-400" : kineticScore >= 50 ? "text-amber-400" : "text-red-400";

  // Coaching panel message
  let coachTitle = "", coachSub = "", coachCSS = "text-white";
  if (active && hasAngles) {
    if (!activeCue) {
      coachTitle = "Perfect form! Every joint is dialed in";
      coachSub   = "Maintain this position — this is what elite athletes look like";
      coachCSS   = "text-emerald-400";
    } else {
      const val = angles[activeCue.joint];
      if (val === undefined) {
        coachTitle = "Step into frame";
        coachSub   = "Make sure your full body is visible to the camera";
        coachCSS   = "text-zinc-400";
      } else if (holdProgress > 10) {
        coachTitle = activeCue.holdMsg;
        coachSub   = `${Math.round(holdProgress)}% locked — keep holding to unlock achievement`;
        coachCSS   = "text-amber-300";
      } else {
        const mid = (activeCue.lo + activeCue.hi) / 2;
        coachTitle = val < mid ? activeCue.tooLowMsg : activeCue.tooHighMsg;
        coachSub   = `${activeCue.joint}: ${Math.round(val)}° → target ${activeCue.lo}–${activeCue.hi}°`;
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Camera feed + skeleton overlay ──────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <video ref={videoRef} className="w-full" playsInline muted style={{ display: active ? "block" : "none" }} />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ display: active ? "block" : "none" }} />

        {/* Kinetic score — top right */}
        {active && hasAngles && (
          <div className="absolute right-3 top-3 flex flex-col items-center rounded-xl border border-zinc-700 bg-black/75 px-3 py-2 backdrop-blur">
            <svg width="54" height="54" viewBox="0 0 54 54">
              <circle cx="27" cy="27" r="23" fill="none" stroke="#27272a" strokeWidth="4" />
              <circle
                cx="27" cy="27" r="23"
                fill="none"
                stroke={scoreColor}
                strokeWidth="4"
                strokeDasharray={`${(kineticScore / 100) * 144.5} 144.5`}
                strokeLinecap="round"
                transform="rotate(-90 27 27)"
              />
              <text x="27" y="32" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                {kineticScore}
              </text>
            </svg>
            <p className={`mt-1 text-center text-xs font-semibold ${scoreCSS}`}>Kinetic<br/>Score</p>
          </div>
        )}

        {/* All perfect badge — top left */}
        {allPerfect && (
          <div className="absolute left-3 top-3 rounded-xl border border-emerald-700 bg-emerald-950/85 px-3 py-2 backdrop-blur">
            <p className="text-sm font-bold text-emerald-400">✦ Elite form</p>
            <p className="text-xs text-emerald-600">All joints dialed in</p>
          </div>
        )}

        {/* Coaching cue — bottom overlay */}
        {active && hasAngles && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-4 pt-10">
            {holdProgress > 5 && (
              <div className="mb-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${holdProgress}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-amber-500">Hold to unlock achievement</p>
              </div>
            )}
            <p className={`text-base font-bold leading-snug ${coachCSS}`}>{coachTitle}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{coachSub}</p>
          </div>
        )}

        {/* Placeholder */}
        {!active && (
          <div className="flex h-56 flex-col items-center justify-center gap-3">
            <p className="text-5xl">🏏</p>
            <p className="text-sm font-semibold text-zinc-300">AI Live Coaching</p>
            <p className="text-xs text-zinc-500">Real-time position feedback · Achievement system · Kinetic score</p>
            <p className="text-xs text-zinc-600">Loads MediaPipe on first start (~5 s)</p>
          </div>
        )}
      </div>

      {/* ── Achievement celebration banner ───────────────────────────────── */}
      {celebCue && (
        <div className="rounded-xl border-2 border-emerald-600 bg-emerald-950/80 p-4">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{celebCue.impactEmoji}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Achievement Unlocked</p>
              <p className="mt-0.5 text-base font-bold text-emerald-300">{celebCue.joint}</p>
              <p className="mt-1 text-sm text-zinc-200">{celebCue.achieveMsg}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-700 bg-emerald-900/40 px-3 py-1 text-xs font-bold text-emerald-400">
                {celebCue.impactLabel}
              </span>
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-950/30 px-3 py-2 text-sm text-red-400">{error}</p>}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {!active ? (
          <button className="btn-primary" onClick={() => void handleStart()} disabled={loading}>
            {loading
              ? <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-100" />
                  Loading model…
                </span>
              : "Start live coaching"
            }
          </button>
        ) : (
          <button className="btn-ghost" onClick={handleStop}>Stop camera</button>
        )}
        <span className="text-xs text-zinc-600">
          Sport: <span className="capitalize text-zinc-400">{analyzerKey}</span>
        </span>
        {active && achievements.size > 0 && (
          <span className="ml-auto text-xs font-semibold text-emerald-500">
            {achievements.size}/{cues.length} mastered
          </span>
        )}
      </div>

      {/* ── Live joint angle grid ─────────────────────────────────────────── */}
      {active && Object.entries(angles).length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Live joint analysis</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(angles).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => {
              const cue = cues.find(c => c.joint === name);
              const status: Status = cue ? getStatus(value, cue.lo, cue.hi) : "good";
              const isCoaching = activeCue?.joint === name;
              const isDone = achievements.has(name);
              return (
                <div
                  key={name}
                  className={`rounded-lg border p-2.5 text-center transition-colors ${
                    isDone     ? "border-emerald-800 bg-emerald-950/25" :
                    isCoaching ? "border-amber-700 bg-amber-950/20" :
                                 "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  {isDone     && <p className="mb-0.5 text-xs text-emerald-500">✓ Achieved</p>}
                  {isCoaching && !isDone && <p className="mb-0.5 animate-pulse text-xs text-amber-500">● Focus here</p>}
                  <p className="text-xs text-zinc-500">{name}</p>
                  <p className={`text-2xl font-bold ${STATUS_CSS[status]}`}>{Math.round(value)}°</p>
                  {cue && <p className="mt-0.5 text-xs text-zinc-600">Target {cue.lo}–{cue.hi}°</p>}
                  <p className={`mt-0.5 text-xs font-medium ${STATUS_CSS[status]}`}>
                    {status === "good" ? "✓ In range" : status === "warn" ? "~ Almost" : "✗ Adjust"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Achievement checklist ─────────────────────────────────────────── */}
      {active && cues.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Coaching checklist
            </p>
            <span className="text-xs text-zinc-500">{achievements.size}/{cues.length} mastered</span>
          </div>

          {/* Overall progress bar */}
          <div className="mb-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(achievements.size / cues.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {cues.map((cue) => {
              const done      = achievements.has(cue.joint);
              const isActive  = activeCue?.joint === cue.joint;
              const val       = angles[cue.joint];
              const status: Status = val !== undefined ? getStatus(val, cue.lo, cue.hi) : "bad";
              const mid       = (cue.lo + cue.hi) / 2;
              const bodyMsg   = done ? cue.achieveMsg
                              : isActive && val !== undefined ? (val < mid ? cue.tooLowMsg : cue.tooHighMsg)
                              : `Target ${cue.lo}–${cue.hi}° · ${cue.impactLabel}`;
              return (
                <div
                  key={cue.joint}
                  className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                    done     ? "bg-emerald-950/20" :
                    isActive ? "bg-amber-950/15 ring-1 ring-amber-800/40" :
                               "bg-zinc-900/40"
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-xl">
                    {done ? "✅" : isActive ? "👉" : "○"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-semibold ${done ? "text-emerald-400" : isActive ? "text-amber-300" : "text-zinc-300"}`}>
                        {cue.joint}
                      </p>
                      {val !== undefined && (
                        <span className={`text-xs font-bold ${STATUS_CSS[status]}`}>{Math.round(val)}°</span>
                      )}
                      <span className="ml-auto shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500">
                        {cue.lo}–{cue.hi}°
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">{bodyMsg}</p>
                    {done && (
                      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                        {cue.impactEmoji} {cue.impactLabel}
                      </span>
                    )}
                    {isActive && !done && holdProgress > 3 && (
                      <div className="mt-2">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all duration-75"
                            style={{ width: `${holdProgress}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          Hold in position — {Math.round(holdProgress)}% to achievement
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
