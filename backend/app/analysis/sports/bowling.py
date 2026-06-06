"""Cricket bowling analyzer.

Adds release-point detection (peak wrist speed of the bowling arm) and
pace-oriented coaching insights comparing two deliveries.
"""
from __future__ import annotations

from typing import Any

import numpy as np

from app.analysis.speed import estimate_release_speed
from app.analysis.sports.base import BaseAnalyzer, VideoAnalysis


def _angle_at(series: np.ndarray, frame: int) -> float | None:
    if series is None or series.size == 0:
        return None
    frame = max(0, min(frame, series.size - 1))
    return float(series[frame])


def _round(value: float | None) -> float | None:
    return round(value, 1) if value is not None else None


# Pace factors: each has a direction (+1 means higher value -> more pace,
# -1 means lower value -> more pace), a change threshold to count as signal,
# a display unit and a plain-language explanation.
PACE_FACTORS = [
    {
        "key": "arm_speed_ms", "label": "Bowling-arm speed at release",
        "unit": "m/s", "direction": 1, "threshold": 0.4,
        "explanation": "Faster hand speed at release is the most direct driver of pace.",
    },
    {
        "key": "elbow_extension_deg", "label": "Arm extension at release",
        "unit": "°", "direction": 1, "threshold": 5,
        "explanation": "A straighter bowling arm at release transfers more energy to the ball.",
    },
    {
        "key": "front_knee_brace_deg", "label": "Front-leg brace",
        "unit": "°", "direction": 1, "threshold": 5,
        "explanation": "A firm, straighter front leg converts run-up momentum into ball speed.",
    },
    {
        "key": "trunk_flexion_deg", "label": "Trunk drive at release",
        "unit": "°", "direction": 1, "threshold": 6,
        "explanation": "Driving the trunk forward over a braced front leg adds pace.",
    },
    {
        "key": "action_tempo_s", "label": "Action time",
        "unit": "s", "direction": -1, "threshold": 0.08,
        "explanation": "A quicker, more rhythmical action tends to produce more pace.",
    },
]


class BowlingAnalyzer(BaseAnalyzer):
    key = "bowling"
    display_name = "Cricket bowling"

    def channels(self) -> list[str]:
        return [
            "left_elbow",
            "right_elbow",
            "left_shoulder",
            "right_shoulder",
            "left_knee",
            "right_knee",
            "trunk_lean",
        ]

    def detect_key_event(
        self, angles: dict[str, np.ndarray], speeds: dict[str, np.ndarray], fps: float
    ) -> dict[str, Any] | None:
        side = self.dominant_side(speeds)
        arm_speed = speeds.get(side)
        if arm_speed is None or arm_speed.size == 0:
            return None
        frame = int(np.argmax(arm_speed))
        return {
            "name": "release",
            "label": "Ball release",
            "frame": frame,
            "time": round(frame / fps, 3) if fps else None,
            "side": side,
            "wrist_speed": round(float(arm_speed[frame]), 4),
        }

    def extra_metrics(
        self,
        pose: Any,
        angles: dict[str, np.ndarray],
        speeds: dict[str, np.ndarray],
        athlete_height_m: float = 1.75,
    ) -> dict[str, Any]:
        side = self.dominant_side(speeds)
        front = "left" if side == "right" else "right"
        key_event = self.detect_key_event(angles, speeds, pose.fps)
        if not key_event:
            return {}
        frame = key_event["frame"]

        estimated = estimate_release_speed(pose, side, frame, athlete_height_m)
        tempo = round(pose.num_frames / pose.fps, 2) if pose.fps else None

        pace_factors = {
            "arm_speed_ms": estimated.get("hand_speed_ms") if estimated else None,
            "elbow_extension_deg": _round(_angle_at(angles.get(f"{side}_elbow"), frame)),
            "front_knee_brace_deg": _round(_angle_at(angles.get(f"{front}_knee"), frame)),
            "trunk_flexion_deg": _round(abs(_angle_at(angles.get("trunk_lean"), frame) or 0.0)),
            "action_tempo_s": tempo,
        }
        return {
            "bowling_side": side,
            "front_side": front,
            "release_frame": frame,
            "estimated_speed": estimated,
            "pace_factors": pace_factors,
        }

    def report_extras(
        self,
        baseline: VideoAnalysis,
        target: VideoAnalysis,
        joint_diffs: list[dict[str, Any]],
        timing: dict[str, Any],
    ) -> dict[str, Any]:
        b_extra = baseline.extra or {}
        t_extra = target.extra or {}
        bf = b_extra.get("pace_factors") or {}
        tf = t_extra.get("pace_factors") or {}
        bs = b_extra.get("estimated_speed") or {}
        ts = t_extra.get("estimated_speed") or {}

        factors: list[dict[str, Any]] = []
        for spec in PACE_FACTORS:
            b_val = bf.get(spec["key"])
            t_val = tf.get(spec["key"])
            if b_val is None or t_val is None:
                continue
            change = round(t_val - b_val, 2)
            helps = spec["direction"] * change > 0
            if abs(change) < spec["threshold"]:
                effect = "neutral"
            else:
                effect = "increases" if helps else "decreases"
            factors.append({
                "key": spec["key"],
                "label": spec["label"],
                "unit": spec["unit"],
                "baseline": b_val,
                "target": t_val,
                "change": change,
                "effect": effect,
                "explanation": spec["explanation"],
            })

        b_kph = bs.get("est_release_speed_kph")
        t_kph = ts.get("est_release_speed_kph")
        estimated = None
        if b_kph is not None and t_kph is not None:
            estimated = {
                "baseline_kph": b_kph,
                "target_kph": t_kph,
                "delta_kph": round(t_kph - b_kph, 1),
                "confidence": round(min(bs.get("confidence", 0), ts.get("confidence", 0)), 2),
                "note": "Estimated from video using body-height calibration - approximate.",
            }

        if not factors and estimated is None:
            return {}
        return {"estimated": estimated, "factors": factors}

    def build_insights(
        self,
        baseline: VideoAnalysis,
        target: VideoAnalysis,
        joint_diffs: list[dict[str, Any]],
        timing: dict[str, Any],
    ) -> list[str]:
        insights: list[str] = []
        side = target.dominant_side or "right"
        # Front leg is opposite the bowling arm.
        front = "left" if side == "right" else "right"

        b_evt = baseline.key_event or {}
        t_evt = target.key_event or {}
        b_frame = b_evt.get("frame", 0)
        t_frame = t_evt.get("frame", 0)

        # 1) Bowling-arm elbow extension at release (straighter arm -> more pace).
        b_elbow = _angle_at(baseline.angles.get(f"{side}_elbow"), b_frame)
        t_elbow = _angle_at(target.angles.get(f"{side}_elbow"), t_frame)
        if b_elbow is not None and t_elbow is not None:
            d = t_elbow - b_elbow
            if abs(d) >= 5:
                insights.append(
                    f"At release your bowling-arm elbow was "
                    f"{'straighter' if d > 0 else 'more bent'} by {abs(d):.0f}° "
                    f"({b_elbow:.0f}° → {t_elbow:.0f}°). A straighter arm at release "
                    f"typically transfers more energy into the ball."
                )

        # 2) Front-knee brace at release (braced front leg -> more pace).
        b_knee = _angle_at(baseline.angles.get(f"{front}_knee"), b_frame)
        t_knee = _angle_at(target.angles.get(f"{front}_knee"), t_frame)
        if b_knee is not None and t_knee is not None:
            d = t_knee - b_knee
            if abs(d) >= 5:
                insights.append(
                    f"Your front ({front}) knee was "
                    f"{'more braced (straighter)' if d > 0 else 'more collapsed (bent)'} "
                    f"by {abs(d):.0f}° at release. A firm front leg is a key driver of pace."
                )

        # 3) Wrist/arm speed at release.
        b_ws = b_evt.get("wrist_speed")
        t_ws = t_evt.get("wrist_speed")
        if b_ws and t_ws and b_ws > 0:
            pct = (t_ws - b_ws) / b_ws * 100.0
            if abs(pct) >= 8:
                insights.append(
                    f"Bowling-arm speed at release was {abs(pct):.0f}% "
                    f"{'higher' if pct > 0 else 'lower'} in the target delivery."
                )

        # 4) Trunk lean at release.
        b_trunk = _angle_at(baseline.angles.get("trunk_lean"), b_frame)
        t_trunk = _angle_at(target.angles.get("trunk_lean"), t_frame)
        if b_trunk is not None and t_trunk is not None:
            d = abs(t_trunk) - abs(b_trunk)
            if abs(d) >= 6:
                insights.append(
                    f"Your trunk was {'more inclined into the crease' if d > 0 else 'more upright'} "
                    f"at release by about {abs(d):.0f}°."
                )

        # 5) Run-up / action tempo.
        tempo = timing.get("tempo_change_pct")
        if tempo is not None and abs(tempo) >= 8:
            insights.append(
                f"Your action tempo was {abs(tempo):.0f}% "
                f"{'quicker' if tempo < 0 else 'slower'} - useful for rhythm and timing."
            )

        # Tie back to measured pace if the athlete supplied it, otherwise use the
        # video-estimated release speed.
        if baseline.metric_value and target.metric_value:
            delta = target.metric_value - baseline.metric_value
            unit = target.metric_unit or "units"
            if abs(delta) >= 0.5:
                headline = (
                    f"Measured pace changed by {abs(delta):.0f} {unit} "
                    f"({baseline.metric_value:.0f} → {target.metric_value:.0f} {unit}). "
                    f"The movement differences below help explain why."
                )
                insights.insert(0, headline)
        else:
            b_kph = (baseline.extra or {}).get("estimated_speed", {}) or {}
            t_kph = (target.extra or {}).get("estimated_speed", {}) or {}
            b_val = b_kph.get("est_release_speed_kph")
            t_val = t_kph.get("est_release_speed_kph")
            if b_val and t_val:
                d = t_val - b_val
                insights.insert(
                    0,
                    f"Estimated release speed changed from ~{b_val:.0f} to ~{t_val:.0f} kph "
                    f"({d >= 0 and '+' or ''}{d:.0f} kph, approximate). "
                    f"Here's what drove the difference:",
                )

        if not insights:
            insights.append(
                "Both deliveries are biomechanically very similar at release - "
                "no major action differences were detected."
            )
        return insights
