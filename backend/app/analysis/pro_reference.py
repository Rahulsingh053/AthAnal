"""Synthetic professional-athlete reference benchmarks for pose comparison.

Reference ranges are derived from published biomechanics literature on elite
athletes (Ferdinands et al., Portus et al. for cricket; general athletic
movement studies for the generic analyzer). Not patient-specific medical advice.
"""
from __future__ import annotations

from typing import Any

import numpy as np

# Each joint entry: label, optimal range (lo, hi), optimal point, unit, note.
_BowlingRef = dict[str, Any]

BOWLING_PRO_RANGES: dict[str, _BowlingRef] = {
    "right_elbow": {
        "label": "Bowling-arm elbow at release",
        "mean_range": (158.0, 178.0),
        "optimal": 168.0,
        "unit": "°",
        "note": "Elite pacemen achieve near-full extension at release for maximum energy transfer.",
    },
    "left_elbow": {
        "label": "Non-bowling arm elbow at release",
        "mean_range": (80.0, 130.0),
        "optimal": 100.0,
        "unit": "°",
        "note": "A cocked front arm aids shoulder counter-rotation and whip.",
    },
    "left_knee": {
        "label": "Front-leg brace (left knee) at delivery",
        "mean_range": (155.0, 178.0),
        "optimal": 167.0,
        "unit": "°",
        "note": "A braced front leg converts horizontal run-up momentum into ball speed.",
    },
    "right_knee": {
        "label": "Front-leg brace (right knee) at delivery",
        "mean_range": (155.0, 178.0),
        "optimal": 167.0,
        "unit": "°",
        "note": "A braced front leg converts horizontal run-up momentum into ball speed.",
    },
    "trunk_lean": {
        "label": "Trunk lean at delivery",
        "mean_range": (-42.0, -18.0),
        "optimal": -30.0,
        "unit": "°",
        "note": "Elite bowlers drive the trunk aggressively forward over the brace to add pace.",
    },
    "left_shoulder": {
        "label": "Non-bowling shoulder elevation",
        "mean_range": (82.0, 132.0),
        "optimal": 108.0,
        "unit": "°",
        "note": "A high front arm is key to shoulder counter-rotation and energy transfer.",
    },
    "right_shoulder": {
        "label": "Bowling-arm shoulder angle",
        "mean_range": (82.0, 132.0),
        "optimal": 108.0,
        "unit": "°",
        "note": "Shoulder angle affects rotation plane and arm-swing efficiency.",
    },
}

GENERIC_PRO_RANGES: dict[str, _BowlingRef] = {
    "left_elbow":    {"label": "Left elbow",     "mean_range": (85.0, 165.0),  "optimal": 130.0, "unit": "°", "note": "Typical athletic movement range for the left elbow."},
    "right_elbow":   {"label": "Right elbow",    "mean_range": (85.0, 165.0),  "optimal": 130.0, "unit": "°", "note": "Typical athletic movement range for the right elbow."},
    "left_knee":     {"label": "Left knee",      "mean_range": (95.0, 175.0),  "optimal": 145.0, "unit": "°", "note": "Optimal knee angle range for power production and shock absorption."},
    "right_knee":    {"label": "Right knee",     "mean_range": (95.0, 175.0),  "optimal": 145.0, "unit": "°", "note": "Optimal knee angle range for power production and shock absorption."},
    "left_shoulder": {"label": "Left shoulder",  "mean_range": (70.0, 160.0),  "optimal": 110.0, "unit": "°", "note": "Shoulder range for coordinated athletic movement."},
    "right_shoulder":{"label": "Right shoulder", "mean_range": (70.0, 160.0),  "optimal": 110.0, "unit": "°", "note": "Shoulder range for coordinated athletic movement."},
    "trunk_lean":    {"label": "Trunk lean",     "mean_range": (-22.0, 22.0),  "optimal": 0.0,   "unit": "°", "note": "Minimal trunk lean is typical for most upright power movements."},
}

PRO_RANGES: dict[str, dict[str, _BowlingRef]] = {
    "bowling": BOWLING_PRO_RANGES,
    "generic": GENERIC_PRO_RANGES,
}


def get_pro_benchmarks(analyzer_key: str) -> dict[str, _BowlingRef]:
    return PRO_RANGES.get(analyzer_key, GENERIC_PRO_RANGES)


def compare_to_pro(
    angles: dict[str, np.ndarray],
    analyzer_key: str,
    key_event_frame: int | None = None,
) -> list[dict[str, Any]]:
    """Compare athlete joint angles to professional benchmarks.

    Uses the key-event frame value when available (e.g. release frame for
    bowling) — the moment that most matters for that sport. Falls back to
    the mean across the whole clip.
    """
    benchmarks = get_pro_benchmarks(analyzer_key)
    comparisons: list[dict[str, Any]] = []

    for joint, ref in benchmarks.items():
        arr = angles.get(joint)
        if arr is None or arr.size == 0:
            continue

        valid = arr[~np.isnan(arr)]
        if valid.size == 0:
            continue

        if key_event_frame is not None:
            frame = max(0, min(key_event_frame, arr.size - 1))
            athlete_val = float(arr[frame]) if not np.isnan(arr[frame]) else float(np.nanmean(arr))
        else:
            athlete_val = float(np.nanmean(valid))

        lo, hi = ref["mean_range"]
        optimal: float = ref["optimal"]

        if lo <= athlete_val <= hi:
            status = "good"
            gap = 0.0
        elif athlete_val < lo:
            status = "below"
            gap = round(lo - athlete_val, 1)
        else:
            status = "above"
            gap = round(athlete_val - hi, 1)

        comparisons.append(
            {
                "joint": joint,
                "label": ref["label"],
                "athlete_value": round(athlete_val, 1),
                "optimal": optimal,
                "pro_range_low": lo,
                "pro_range_high": hi,
                "status": status,
                "gap_deg": gap,
                "unit": ref["unit"],
                "note": ref["note"],
            }
        )

    comparisons.sort(key=lambda c: (0 if c["status"] != "good" else 1, -c["gap_deg"]))
    return comparisons
