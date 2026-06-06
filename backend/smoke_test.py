"""Quick non-network smoke test for imports, DB init, and the comparator math."""
import json

import numpy as np

import app.main  # noqa: F401  (ensures the whole app imports cleanly)
from app.analysis.comparator import compare
from app.analysis.registry import get_analyzer
from app.analysis.sports.base import VideoAnalysis
from app.core.database import init_db
from app.seed import seed_sports
from app.utils import to_jsonable

print("1) App imported OK")

init_db()
seed_sports()
print("2) DB initialized + sports seeded OK")


def make_analysis(label, metric, *, elbow_peak, knee_mean, n=140, fps=30.0):
    """Synthesize a plausible bowling-arm angle profile."""
    t = np.linspace(0, 1, n)
    # Elbow extends sharply near release (~70% through the clip).
    elbow = 90 + (elbow_peak - 90) * np.exp(-((t - 0.7) ** 2) / 0.01)
    knee = knee_mean + 8 * np.sin(2 * np.pi * t)
    shoulder = 60 + 40 * np.sin(2 * np.pi * t + 0.5)
    trunk = 10 + 5 * np.sin(2 * np.pi * t)
    angles = {
        "right_elbow": elbow,
        "right_shoulder": shoulder,
        "right_knee": knee,
        "left_knee": knee - 5,
        "trunk_lean": trunk,
    }
    # Bowling (right) arm has a clear speed spike at release.
    speed_r = np.exp(-((t - 0.7) ** 2) / 0.005)
    speeds = {"right": speed_r, "left": speed_r * 0.3}
    analyzer = get_analyzer("bowling")
    return VideoAnalysis(
        fps=fps,
        angles=angles,
        speeds=speeds,
        label=label,
        metric_value=metric,
        metric_unit="kph",
        dominant_side="right",
        key_event=analyzer.detect_key_event(angles, speeds, fps),
    )


analyzer = get_analyzer("bowling")
baseline = make_analysis("124 kph", 124, elbow_peak=150, knee_mean=150)
target = make_analysis("140 kph", 140, elbow_peak=172, knee_mean=170)

report = compare(baseline, target, analyzer)
report = to_jsonable(report)

# Must be JSON serializable (this is what gets stored in the DB).
json.dumps(report)
print("3) Comparator produced a JSON-serializable report OK")
print("   similarity:", report["summary"]["similarity_score"])
print("   metric:", report["summary"]["metric"])
print("   top joint diff:", report["joint_differences"][0]["label"],
      report["joint_differences"][0]["mean_abs_diff_deg"], "deg")
print("   insights:")
for line in report["insights"]:
    print("    -", line)
print("ALL SMOKE CHECKS PASSED")
