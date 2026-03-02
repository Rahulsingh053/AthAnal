"""Turn two analyzed videos into a structured comparison report."""
from __future__ import annotations

import math
from typing import Any

import numpy as np

from app.analysis.alignment import dtw, resample, zscore
from app.analysis.injury_risk import flag_injury_risks
from app.analysis.landmarks import ANGLE_LABELS
from app.analysis.metrics import range_of_motion
from app.analysis.phases import detect_phases
from app.analysis.pro_reference import compare_to_pro
from app.analysis.sports.base import BaseAnalyzer, VideoAnalysis

CHART_POINTS = 120


def _similarity_score(distance: float, num_channels: int) -> int:
    """Map mean per-step z-distance to a 0–100 similarity score."""
    if num_channels <= 0:
        return 0
    avg = distance / math.sqrt(num_channels)
    score = 100.0 * math.exp(-avg / 2.0)
    return int(round(max(0.0, min(100.0, score))))


def compare(
    baseline: VideoAnalysis, target: VideoAnalysis, analyzer: BaseAnalyzer
) -> dict[str, Any]:
    channels = [
        c
        for c in analyzer.channels()
        if c in baseline.angles
        and c in target.angles
        and baseline.angles[c].size > 1
        and target.angles[c].size > 1
    ]
    if not channels:
        raise ValueError("No common analysable joints between the two videos.")

    b_stack = np.stack([baseline.angles[c] for c in channels], axis=1)
    t_stack = np.stack([target.angles[c] for c in channels], axis=1)

    mean = np.mean(b_stack, axis=0)
    std = np.std(b_stack, axis=0)
    distance, path = dtw(zscore(b_stack, mean, std), zscore(t_stack, mean, std))
    similarity = _similarity_score(distance, len(channels))

    path_arr = np.array(path)
    bi, ti = path_arr[:, 0], path_arr[:, 1]

    joint_diffs: list[dict[str, Any]] = []
    for ch in channels:
        b_series = baseline.angles[ch]
        t_series = target.angles[ch]
        mean_abs = float(np.mean(np.abs(t_series[ti] - b_series[bi])))
        b_mean = float(np.mean(b_series))
        t_mean = float(np.mean(t_series))
        b_rom = range_of_motion(b_series)
        t_rom = range_of_motion(t_series)
        joint_diffs.append(
            {
                "channel": ch,
                "label": ANGLE_LABELS.get(ch, ch),
                "baseline_mean": round(b_mean, 1),
                "target_mean": round(t_mean, 1),
                "mean_delta": round(t_mean - b_mean, 1),
                "baseline_rom": round(b_rom, 1),
                "target_rom": round(t_rom, 1),
                "rom_delta": round(t_rom - b_rom, 1),
                "mean_abs_diff_deg": round(mean_abs, 1),
            }
        )

    b_dur = len(b_stack) / baseline.fps if baseline.fps else 0.0
    t_dur = len(t_stack) / target.fps if target.fps else 0.0
    tempo_change = ((t_dur - b_dur) / b_dur * 100.0) if b_dur > 0 else None
    timing = {
        "baseline_duration_s": round(b_dur, 2),
        "target_duration_s": round(t_dur, 2),
        "tempo_change_pct": round(tempo_change, 1) if tempo_change is not None else None,
    }

    insights = analyzer.build_insights(baseline, target, joint_diffs, timing)

    angle_series: dict[str, Any] = {}
    for ch in channels:
        angle_series[ch] = {
            "label": ANGLE_LABELS.get(ch, ch),
            "baseline": [round(v, 1) for v in resample(baseline.angles[ch], CHART_POINTS)],
            "target": [round(v, 1) for v in resample(target.angles[ch], CHART_POINTS)],
        }

    metric = None
    if baseline.metric_value is not None and target.metric_value is not None:
        metric = {
            "baseline": baseline.metric_value,
            "target": target.metric_value,
            "unit": target.metric_unit or baseline.metric_unit,
            "delta": round(target.metric_value - baseline.metric_value, 2),
        }

    joint_diffs.sort(key=lambda d: d["mean_abs_diff_deg"], reverse=True)

    speed_analysis = analyzer.report_extras(baseline, target, joint_diffs, timing)

    report: dict[str, Any] = {
        "summary": {
            "similarity_score": similarity,
            "headline": (
                f"{similarity}% movement similarity between "
                f"'{baseline.label or 'baseline'}' and '{target.label or 'target'}'."
            ),
            "baseline_label": baseline.label,
            "target_label": target.label,
            "dominant_side": target.dominant_side,
            "analyzer": analyzer.display_name,
            "metric": metric,
        },
        "joint_differences": joint_diffs,
        "timing": timing,
        "key_events": {
            "baseline": baseline.key_event,
            "target": target.key_event,
        },
        "insights": insights,
        "angle_series": {
            "points": CHART_POINTS,
            "timeline_pct": [round(i / (CHART_POINTS - 1) * 100, 1) for i in range(CHART_POINTS)],
            "channels": angle_series,
        },
    }
    if speed_analysis:
        report["speed_analysis"] = speed_analysis

    # --- Phase detection ------------------------------------------------
    b_phases = detect_phases(
        baseline.angles, baseline.speeds, baseline.fps,
        analyzer.key, baseline.key_event,
    )
    t_phases = detect_phases(
        target.angles, target.speeds, target.fps,
        analyzer.key, target.key_event,
    )
    report["phases"] = {"baseline": b_phases, "target": t_phases}

    # --- Injury risk flagging (target video) ----------------------------
    report["injury_risks"] = flag_injury_risks(target.angles, target.fps)

    # --- Pro-athlete comparison (target video) -------------------------
    key_frame = target.key_event.get("frame") if target.key_event else None
    report["pro_comparison"] = compare_to_pro(target.angles, analyzer.key, key_frame)

    return report
