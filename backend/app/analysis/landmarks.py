"""MediaPipe Pose landmark indices and joint-angle definitions.

These are framework-agnostic constants so the rest of the engine never depends
on MediaPipe being importable.
"""
from __future__ import annotations

# MediaPipe Pose (BlazePose) 33-landmark model indices we care about.
LANDMARK_INDEX: dict[str, int] = {
    "nose": 0,
    "left_shoulder": 11,
    "right_shoulder": 12,
    "left_elbow": 13,
    "right_elbow": 14,
    "left_wrist": 15,
    "right_wrist": 16,
    "left_hip": 23,
    "right_hip": 24,
    "left_knee": 25,
    "right_knee": 26,
    "left_ankle": 27,
    "right_ankle": 28,
}

NUM_LANDMARKS = 33

# Joint angle = angle at the middle point formed by (a, vertex, c).
# Human-readable label is used in reports.
ANGLE_DEFINITIONS: dict[str, tuple[str, str, str]] = {
    "left_elbow": ("left_shoulder", "left_elbow", "left_wrist"),
    "right_elbow": ("right_shoulder", "right_elbow", "right_wrist"),
    "left_shoulder": ("left_hip", "left_shoulder", "left_elbow"),
    "right_shoulder": ("right_hip", "right_shoulder", "right_elbow"),
    "left_hip": ("left_shoulder", "left_hip", "left_knee"),
    "right_hip": ("right_shoulder", "right_hip", "right_knee"),
    "left_knee": ("left_hip", "left_knee", "left_ankle"),
    "right_knee": ("right_hip", "right_knee", "right_ankle"),
}

ANGLE_LABELS: dict[str, str] = {
    "left_elbow": "Left elbow",
    "right_elbow": "Right elbow",
    "left_shoulder": "Left shoulder",
    "right_shoulder": "Right shoulder",
    "left_hip": "Left hip",
    "right_hip": "Right hip",
    "left_knee": "Left knee",
    "right_knee": "Right knee",
    "trunk_lean": "Trunk lean",
}
