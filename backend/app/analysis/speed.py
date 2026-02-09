"""Approximate release-speed estimation from monocular video.

This is an *estimate*. Absolute accuracy from a single camera is limited without
ball tracking or a known real-world scale reference. We calibrate pixels to
metres using the bowler's body height, which makes the number reasonable and -
importantly - comparable across clips filmed at different zoom levels.
"""
from __future__ import annotations

import numpy as np

from app.analysis.landmarks import LANDMARK_INDEX
from app.analysis.pose import PoseSequence

# Nose-to-ankle distance is roughly this fraction of full standing height.
NOSE_TO_ANKLE_FRACTION = 0.87


def _px(pose: PoseSequence, name: str, frame: int) -> np.ndarray:
    i = LANDMARK_INDEX[name]
    lm = pose.landmarks[frame, i]
    return np.array([lm[0] * pose.frame_width, lm[1] * pose.frame_height])


def _body_pixel_height(pose: PoseSequence, frame: int) -> float:
    nose = _px(pose, "nose", frame)
    ankle = (_px(pose, "left_ankle", frame) + _px(pose, "right_ankle", frame)) / 2.0
    return float(np.linalg.norm(nose - ankle))


def estimate_release_speed(
    pose: PoseSequence,
    side: str,
    release_frame: int,
    athlete_height_m: float = 1.75,
) -> dict | None:
    """Estimate the bowling hand speed at release and an approximate ball speed.

    Returns a dict with ``hand_speed_ms``, ``est_release_speed_kph``,
    ``confidence`` and ``release_frame`` - or ``None`` if it cannot be computed.
    """
    n = pose.num_frames
    if n < 3:
        return None
    f = int(max(1, min(release_frame, n - 2)))

    wrist_name = f"{side}_wrist"
    wi = LANDMARK_INDEX[wrist_name]

    # Central difference around release for a stable velocity estimate.
    p_prev = _px(pose, wrist_name, f - 1)
    p_next = _px(pose, wrist_name, f + 1)
    dt = 2.0 / (pose.fps if pose.fps > 0 else 30.0)
    speed_px_s = float(np.linalg.norm(p_next - p_prev) / dt)

    body_px = _body_pixel_height(pose, f)
    if body_px <= 1.0:
        return None
    metres_per_px = (athlete_height_m * NOSE_TO_ANKLE_FRACTION) / body_px

    hand_speed_ms = speed_px_s * metres_per_px
    est_kph = hand_speed_ms * 3.6

    vis_window = pose.visibility[max(0, f - 1) : f + 2, wi]
    confidence = float(np.mean(vis_window)) if vis_window.size else 0.0

    # Guard against absurd values from tracking glitches.
    if not np.isfinite(est_kph) or est_kph <= 0 or est_kph > 220:
        return {
            "hand_speed_ms": round(hand_speed_ms, 2),
            "est_release_speed_kph": None,
            "confidence": round(confidence, 2),
            "release_frame": f,
            "unreliable": True,
        }

    return {
        "hand_speed_ms": round(hand_speed_ms, 2),
        "est_release_speed_kph": round(est_kph, 1),
        "confidence": round(confidence, 2),
        "release_frame": f,
        "unreliable": confidence < 0.4,
    }
