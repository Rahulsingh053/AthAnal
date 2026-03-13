"""Smoke test for speed estimation and pace-factor attribution."""
import json

import numpy as np

from app.analysis.comparator import compare
from app.analysis.landmarks import LANDMARK_INDEX
from app.analysis.metrics import joint_angle_series, wrist_speed_series
from app.analysis.pose import PoseSequence
from app.analysis.registry import get_analyzer
from app.analysis.sports.base import VideoAnalysis
from app.utils import to_jsonable


def synthetic_pose(n=140, fps=30.0, wrist_throw=0.30):
    """Build a PoseSequence with a right-arm speed spike near release."""
    lm = np.zeros((n, 33, 3), dtype=np.float32)
    vis = np.ones((n, 33), dtype=np.float32)
    t = np.linspace(0, 1, n)
    bump = np.exp(-((t - 0.7) ** 2) / 0.003)  # spike ~70% through

    def setp(name, x, y):
        i = LANDMARK_INDEX[name]
        lm[:, i, 0] = x
        lm[:, i, 1] = y

    setp("nose", 0.5, 0.10)
    setp("left_shoulder", 0.45, 0.30)
    setp("right_shoulder", 0.55, 0.30)
    setp("left_elbow", 0.42, 0.45)
    setp("left_hip", 0.46, 0.55)
    setp("right_hip", 0.54, 0.55)
    setp("left_knee", 0.46, 0.75)
    setp("right_knee", 0.54, 0.75)
    setp("left_ankle", 0.46, 0.92)
    setp("right_ankle", 0.54, 0.92)
    setp("left_wrist", 0.40, 0.50)

    # Right arm whips through release.
    re = LANDMARK_INDEX["right_elbow"]
    rw = LANDMARK_INDEX["right_wrist"]
    lm[:, re, 0] = 0.55 + 0.05 * bump
    lm[:, re, 1] = 0.40 - 0.05 * bump
    lm[:, rw, 0] = 0.55 + wrist_throw * bump
    lm[:, rw, 1] = 0.25 - 0.10 * bump

    return PoseSequence(
        landmarks=lm, visibility=vis, fps=fps, frame_width=1280, frame_height=720
    )


analyzer = get_analyzer("bowling")

# 1) Per-video extras (estimated speed + pace factors)
pose_slow = synthetic_pose(wrist_throw=0.22)
pose_fast = synthetic_pose(wrist_throw=0.34)

extra_slow = analyzer.extra_metrics(
    pose_slow, joint_angle_series(pose_slow), wrist_speed_series(pose_slow), 1.80
)
extra_fast = analyzer.extra_metrics(
    pose_fast, joint_angle_series(pose_fast), wrist_speed_series(pose_fast), 1.80
)
print("1) extra_metrics produced estimated speed:")
print("   slow:", extra_slow["estimated_speed"])
print("   fast:", extra_fast["estimated_speed"])
assert extra_slow["estimated_speed"]["est_release_speed_kph"] is not None

# 2) Full comparison includes a speed_analysis section
def va(label, extra, fps=30.0):
    pose = synthetic_pose()
    angles = joint_angle_series(pose)
    speeds = wrist_speed_series(pose)
    return VideoAnalysis(
        fps=fps, angles=angles, speeds=speeds, label=label,
        metric_value=None, metric_unit=None,
        dominant_side="right",
        key_event=analyzer.detect_key_event(angles, speeds, fps),
        extra=extra,
    )

baseline = va("Slower", extra_slow)
target = va("Faster", extra_fast)
report = to_jsonable(compare(baseline, target, analyzer))
json.dumps(report)

sa = report.get("speed_analysis")
print("\n2) speed_analysis present:", sa is not None)
print("   estimated:", sa["estimated"])
print("   factors:")
for f in sa["factors"]:
    print(f"    - {f['label']}: {f['baseline']} -> {f['target']} {f['unit']} [{f['effect']}]")

print("\nALL SPEED SMOKE CHECKS PASSED")
