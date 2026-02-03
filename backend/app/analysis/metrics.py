"""Derive biomechanical time-series (joint angles, trunk lean, limb speed)
from a :class:`PoseSequence`.
"""
from __future__ import annotations

import numpy as np

from app.analysis.landmarks import ANGLE_DEFINITIONS, LANDMARK_INDEX
from app.analysis.pose import PoseSequence

VISIBILITY_THRESHOLD = 0.3


def _angle_at(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> np.ndarray:
    """Angle (degrees) at vertex ``b`` for each frame.

    a, b, c are (T, 2) arrays of x, y coordinates.
    """
    ba = a - b
    bc = c - b
    dot = np.sum(ba * bc, axis=1)
    norm = np.linalg.norm(ba, axis=1) * np.linalg.norm(bc, axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        cos = np.clip(dot / norm, -1.0, 1.0)
    return np.degrees(np.arccos(cos))


def _clean(series: np.ndarray) -> np.ndarray:
    """Linear-interpolate NaNs and lightly smooth a 1-D series."""
    series = series.astype(np.float64)
    nans = np.isnan(series)
    if nans.all():
        return series
    idx = np.arange(series.size)
    series[nans] = np.interp(idx[nans], idx[~nans], series[~nans])
    # 3-tap moving average for light smoothing.
    if series.size >= 3:
        kernel = np.ones(3) / 3.0
        series = np.convolve(series, kernel, mode="same")
    return series


def joint_angle_series(pose: PoseSequence) -> dict[str, np.ndarray]:
    """Return a cleaned angle series (degrees) per joint channel."""
    xy = pose.landmarks[:, :, :2]
    vis = pose.visibility
    out: dict[str, np.ndarray] = {}

    for channel, (a_name, b_name, c_name) in ANGLE_DEFINITIONS.items():
        ai, bi, ci = (
            LANDMARK_INDEX[a_name],
            LANDMARK_INDEX[b_name],
            LANDMARK_INDEX[c_name],
        )
        angles = _angle_at(xy[:, ai], xy[:, bi], xy[:, ci])
        low_vis = (
            (vis[:, ai] < VISIBILITY_THRESHOLD)
            | (vis[:, bi] < VISIBILITY_THRESHOLD)
            | (vis[:, ci] < VISIBILITY_THRESHOLD)
        )
        angles[low_vis] = np.nan
        out[channel] = _clean(angles)

    out["trunk_lean"] = _trunk_lean_series(pose)
    return out


def _trunk_lean_series(pose: PoseSequence) -> np.ndarray:
    """Forward/backward trunk lean vs. vertical, in degrees."""
    xy = pose.landmarks[:, :, :2]
    ls, rs = LANDMARK_INDEX["left_shoulder"], LANDMARK_INDEX["right_shoulder"]
    lh, rh = LANDMARK_INDEX["left_hip"], LANDMARK_INDEX["right_hip"]
    shoulder_mid = (xy[:, ls] + xy[:, rs]) / 2.0
    hip_mid = (xy[:, lh] + xy[:, rh]) / 2.0
    vec = shoulder_mid - hip_mid  # points from hips up to shoulders
    # Angle from vertical axis (image y grows downward, so flip y).
    angle = np.degrees(np.arctan2(vec[:, 0], -vec[:, 1]))
    return _clean(angle)


def wrist_speed_series(pose: PoseSequence) -> dict[str, np.ndarray]:
    """Normalized wrist speed per frame for each side (used to find release)."""
    xy = pose.landmarks[:, :, :2]
    fps = pose.fps if pose.fps > 0 else 30.0
    out: dict[str, np.ndarray] = {}
    for side in ("left", "right"):
        wi = LANDMARK_INDEX[f"{side}_wrist"]
        pos = xy[:, wi]
        vel = np.gradient(pos, axis=0) * fps
        speed = np.linalg.norm(vel, axis=1)
        out[side] = _clean(speed)
    return out


def range_of_motion(series: np.ndarray) -> float:
    """Peak-to-peak range of a series, robust to outliers (5th–95th pct)."""
    if series.size == 0:
        return 0.0
    lo, hi = np.percentile(series, [5, 95])
    return float(hi - lo)
