"""Base movement analyzer + generic, sport-agnostic implementation."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.analysis.landmarks import ANGLE_DEFINITIONS, ANGLE_LABELS
from app.analysis.metrics import range_of_motion

# Below these magnitudes, a change is treated as noise rather than signal.
MEAN_ANGLE_THRESHOLD_DEG = 6.0
ROM_THRESHOLD_DEG = 8.0


@dataclass
class VideoAnalysis:
    """Runtime container for one analyzed video, used by the comparator."""

    fps: float
    angles: dict[str, np.ndarray]
    speeds: dict[str, np.ndarray]
    label: str = ""
    metric_value: float | None = None
    metric_unit: str | None = None
    dominant_side: str = "right"
    key_event: dict[str, Any] | None = None
    extra: dict[str, Any] = field(default_factory=dict)


class BaseAnalyzer:
    """Generic analyzer. Sports subclass this to add domain knowledge."""

    key = "generic"
    display_name = "Generic movement"

    def channels(self) -> list[str]:
        """Angle channels this analyzer reasons about."""
        return list(ANGLE_DEFINITIONS.keys()) + ["trunk_lean"]

    # --- per-video stage -------------------------------------------------
    def dominant_side(self, speeds: dict[str, np.ndarray]) -> str:
        left_peak = float(np.max(speeds["left"])) if "left" in speeds else 0.0
        right_peak = float(np.max(speeds["right"])) if "right" in speeds else 0.0
        return "left" if left_peak > right_peak else "right"

    def detect_key_event(
        self, angles: dict[str, np.ndarray], speeds: dict[str, np.ndarray], fps: float
    ) -> dict[str, Any] | None:
        """Generic 'peak action' = frame of maximum limb speed."""
        side = self.dominant_side(speeds)
        if side not in speeds or speeds[side].size == 0:
            return None
        frame = int(np.argmax(speeds[side]))
        return {
            "name": "peak_action",
            "label": "Peak action",
            "frame": frame,
            "time": round(frame / fps, 3) if fps else None,
            "side": side,
        }

    def extra_metrics(
        self,
        pose: Any,
        angles: dict[str, np.ndarray],
        speeds: dict[str, np.ndarray],
        athlete_height_m: float = 1.75,
    ) -> dict[str, Any]:
        """Optional per-video extras (e.g. estimated speed, pace factors).

        ``pose`` is the raw PoseSequence so analyzers can access pixel data.
        Generic analyzer computes nothing extra.
        """
        return {}

    def report_extras(
        self,
        baseline: "VideoAnalysis",
        target: "VideoAnalysis",
        joint_diffs: list[dict[str, Any]],
        timing: dict[str, Any],
    ) -> dict[str, Any]:
        """Optional structured comparison sections (e.g. speed attribution)."""
        return {}

    def summarize(
        self, angles: dict[str, np.ndarray], speeds: dict[str, np.ndarray], fps: float
    ) -> dict[str, Any]:
        rom = {ch: round(range_of_motion(a), 2) for ch, a in angles.items()}
        means = {ch: round(float(np.nanmean(a)), 2) for ch, a in angles.items()}
        return {
            "dominant_side": self.dominant_side(speeds),
            "range_of_motion": rom,
            "mean_angles": means,
            "key_event": self.detect_key_event(angles, speeds, fps),
        }

    # --- comparison stage ------------------------------------------------
    def build_insights(
        self,
        baseline: VideoAnalysis,
        target: VideoAnalysis,
        joint_diffs: list[dict[str, Any]],
        timing: dict[str, Any],
    ) -> list[str]:
        insights: list[str] = []

        ranked = sorted(
            joint_diffs, key=lambda d: d["mean_abs_diff_deg"], reverse=True
        )
        for diff in ranked:
            phrase = self._phrase_joint(diff)
            if phrase:
                insights.append(phrase)
            if len(insights) >= 4:
                break

        tempo = timing.get("tempo_change_pct")
        if tempo is not None and abs(tempo) >= 8:
            faster = tempo < 0
            insights.append(
                f"Your overall movement tempo was {abs(tempo):.0f}% "
                f"{'quicker' if faster else 'slower'} in the target video."
            )

        if not insights:
            insights.append(
                "The two performances are biomechanically very similar - "
                "no large movement differences were detected."
            )
        return insights

    def _phrase_joint(self, diff: dict[str, Any]) -> str | None:
        label = diff["label"]
        channel = diff["channel"]
        mean_delta = diff["mean_delta"]
        rom_delta = diff["rom_delta"]

        if channel == "trunk_lean":
            if abs(mean_delta) >= MEAN_ANGLE_THRESHOLD_DEG:
                more = abs(target_abs(diff)) > abs(baseline_abs(diff))
                return (
                    f"Your trunk was {'more inclined' if more else 'more upright'} "
                    f"by about {abs(mean_delta):.0f}°."
                )
            return None

        if abs(mean_delta) >= MEAN_ANGLE_THRESHOLD_DEG:
            word = "more extended (straighter)" if mean_delta > 0 else "more flexed (bent)"
            return f"Your {label.lower()} was {word} by about {abs(mean_delta):.0f}° on average."

        if abs(rom_delta) >= ROM_THRESHOLD_DEG:
            word = "a greater range of motion" if rom_delta > 0 else "a smaller range of motion"
            return f"Your {label.lower()} moved through {word} ({abs(rom_delta):.0f}° change)."

        return None


def baseline_abs(diff: dict[str, Any]) -> float:
    return diff.get("baseline_mean", 0.0)


def target_abs(diff: dict[str, Any]) -> float:
    return diff.get("target_mean", 0.0)
