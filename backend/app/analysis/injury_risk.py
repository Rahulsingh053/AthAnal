"""Injury risk flagging based on joint angle thresholds.

Compares observed joint angle extremes against safe ranges derived from
published sports biomechanics literature. This is a screening tool only —
it does not replace professional medical assessment.
"""
from __future__ import annotations

from typing import Any

import numpy as np

# (min_safe, max_safe, risk_label, severity)
JOINT_SAFE_RANGES: dict[str, tuple[float, float, str, str]] = {
    "left_elbow":    (40.0, 185.0, "elbow hyperextension",    "high"),
    "right_elbow":   (40.0, 185.0, "elbow hyperextension",    "high"),
    "left_knee":     (65.0, 185.0, "knee hyperextension",     "high"),
    "right_knee":    (65.0, 185.0, "knee hyperextension",     "high"),
    "left_shoulder": (10.0, 178.0, "shoulder extreme range",  "medium"),
    "right_shoulder":(10.0, 178.0, "shoulder extreme range",  "medium"),
    "left_hip":      (35.0, 180.0, "hip extreme range",       "medium"),
    "right_hip":     (35.0, 180.0, "hip extreme range",       "medium"),
    "trunk_lean":    (-52.0, 52.0, "extreme trunk lean",      "medium"),
}

RISK_DESCRIPTIONS: dict[str, str] = {
    "elbow hyperextension":   "Elbow angle exceeds safe extension — risk of UCL stress or hyperextension injury.",
    "knee hyperextension":    "Knee extends beyond safe range — risk of ACL/PCL stress at landing or delivery.",
    "shoulder extreme range": "Shoulder reaches extreme range of motion — risk of rotator cuff or labrum stress.",
    "hip extreme range":      "Hip angle at extreme — monitor for femoroacetabular impingement.",
    "extreme trunk lean":     "Extreme trunk lean detected — risk of lumbar spine overload.",
}

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def flag_injury_risks(
    angles: dict[str, np.ndarray],
    fps: float,
) -> list[dict[str, Any]]:
    """Return a list of injury risk flags based on 2nd/98th-percentile angle extremes.

    Uses percentiles rather than frame-by-frame peaks to avoid flagging
    single noisy frames as risks.
    """
    flags: list[dict[str, Any]] = []

    for joint, arr in angles.items():
        spec = JOINT_SAFE_RANGES.get(joint)
        if spec is None or arr.size == 0:
            continue
        min_safe, max_safe, risk_label, severity = spec

        valid = arr[~np.isnan(arr)]
        if valid.size < 3:
            continue

        lo_val = float(np.percentile(valid, 2))
        hi_val = float(np.percentile(valid, 98))

        candidates: list[tuple[str, float, float]] = []
        if lo_val < min_safe:
            candidates.append(("low", lo_val, min_safe))
        if hi_val > max_safe:
            candidates.append(("high", hi_val, max_safe))

        for direction, actual, threshold in candidates:
            deviation = abs(actual - threshold)
            if deviation < 4.0:
                continue
            flags.append(
                {
                    "joint": joint,
                    "label": joint.replace("_", " ").title(),
                    "risk_label": risk_label,
                    "severity": severity,
                    "direction": direction,
                    "observed_angle": round(actual, 1),
                    "safe_threshold": threshold,
                    "deviation_deg": round(deviation, 1),
                    "message": RISK_DESCRIPTIONS.get(risk_label, risk_label),
                }
            )

    flags.sort(key=lambda f: (SEVERITY_ORDER.get(f["severity"], 3), -f["deviation_deg"]))
    return flags
