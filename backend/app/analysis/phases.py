"""Movement phase detection for different sports.

Partitions the per-frame angle timeline into named sport-specific phases
so the frontend can annotate angle charts with phase boundaries.
"""
from __future__ import annotations

from typing import Any

import numpy as np


def _smooth(arr: np.ndarray, window: int = 5) -> np.ndarray:
    if arr.size <= window:
        return arr
    kernel = np.ones(window) / window
    return np.convolve(arr, kernel, mode="same")


def _pct(frame: int, n: int) -> float:
    return round(frame / max(n - 1, 1) * 100.0, 1)


def detect_phases_bowling(
    angles: dict[str, np.ndarray],
    speeds: dict[str, np.ndarray],
    fps: float,
    release_frame: int | None = None,
) -> list[dict[str, Any]]:
    """Detect cricket bowling phases: run-up → gather → delivery stride → release → follow-through."""
    n = max((a.size for a in angles.values()), default=0)
    if n == 0:
        return []

    if release_frame is None:
        side_speed = speeds.get("right") or speeds.get("left")
        if side_speed is not None and side_speed.size > 0:
            release_frame = int(np.argmax(side_speed))
        else:
            release_frame = n // 2

    rf = max(1, min(release_frame, n - 2))
    gather = max(1, int(rf * 0.55))
    stride = max(gather + 1, int(rf * 0.78))
    follow = min(n - 1, rf + 1)

    raw = [
        ("run_up", "Run-up", 0, gather, "#6366f1"),
        ("gather", "Gather & load", gather, stride, "#8b5cf6"),
        ("delivery_stride", "Delivery stride", stride, rf, "#ec4899"),
        ("release", "Release", rf, follow, "#f59e0b"),
        ("follow_through", "Follow-through", follow, n - 1, "#10b981"),
    ]
    return [
        {
            "name": name,
            "label": label,
            "start_frame": s,
            "end_frame": e,
            "start_pct": _pct(s, n),
            "end_pct": _pct(e, n),
            "color": color,
        }
        for name, label, s, e, color in raw
        if s < e
    ]


def detect_phases_generic(
    angles: dict[str, np.ndarray],
    speeds: dict[str, np.ndarray],
    fps: float,
) -> list[dict[str, Any]]:
    """Generic 3-phase detection: preparation → peak action → recovery."""
    n = max((a.size for a in angles.values()), default=0)
    if n == 0:
        return []

    all_speeds = [s for s in speeds.values() if s.size > 0]
    if all_speeds:
        stacked = np.max(np.stack(all_speeds, axis=0), axis=0) if len(all_speeds) > 1 else all_speeds[0]
        peak = int(np.argmax(_smooth(stacked)))
    else:
        peak = n // 2

    prep_end = max(1, int(peak * 0.70))
    action_end = min(n - 1, int(peak + (n - peak) * 0.30))

    raw = [
        ("preparation", "Preparation", 0, prep_end, "#6366f1"),
        ("action", "Peak action", prep_end, action_end, "#f59e0b"),
        ("recovery", "Recovery", action_end, n - 1, "#10b981"),
    ]
    return [
        {
            "name": name,
            "label": label,
            "start_frame": s,
            "end_frame": e,
            "start_pct": _pct(s, n),
            "end_pct": _pct(e, n),
            "color": color,
        }
        for name, label, s, e, color in raw
        if s < e
    ]


def detect_phases(
    angles: dict[str, np.ndarray],
    speeds: dict[str, np.ndarray],
    fps: float,
    analyzer_key: str,
    key_event: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Dispatch to sport-specific phase detector."""
    release_frame = key_event.get("frame") if key_event else None
    if analyzer_key == "bowling":
        return detect_phases_bowling(angles, speeds, fps, release_frame)
    return detect_phases_generic(angles, speeds, fps)
