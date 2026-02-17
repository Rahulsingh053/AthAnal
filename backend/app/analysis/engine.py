"""Orchestration: video file -> pose -> metrics -> persisted analysis, and
reconstruction of analyses for comparison.
"""
from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from app.analysis.metrics import joint_angle_series, wrist_speed_series
from app.analysis.pose import PoseExtractor
from app.analysis.registry import get_analyzer
from app.analysis.sports.base import BaseAnalyzer, VideoAnalysis
from app.core.config import settings


@dataclass
class AnalysisResult:
    fps: float
    frame_count: int
    duration_seconds: float
    angles: dict[str, np.ndarray]
    speeds: dict[str, np.ndarray]
    summary: dict[str, Any]
    extra: dict[str, Any] = field(default_factory=dict)


def _downsample_for_summary(angles: dict[str, np.ndarray], points: int = 80) -> dict[str, list[float]]:
    from app.analysis.alignment import resample

    return {ch: [round(v, 1) for v in resample(a, points)] for ch, a in angles.items()}


def analyze_video(
    video_path: str,
    analyzer_key: str,
    max_frames: int | None = None,
    on_progress: Callable[[int, int], None] | None = None,
) -> AnalysisResult:
    """Full per-video pipeline: extract pose, derive metrics, summarize."""
    analyzer = get_analyzer(analyzer_key)
    extractor = PoseExtractor(
        min_detection_confidence=settings.pose_min_detection_confidence,
        min_tracking_confidence=settings.pose_min_tracking_confidence,
        max_frames=max_frames or settings.max_analysis_frames,
        max_frame_width=settings.pose_max_frame_width,
    )
    pose = extractor.extract(video_path, on_progress=on_progress)
    angles = joint_angle_series(pose)
    speeds = wrist_speed_series(pose)

    extra = analyzer.extra_metrics(pose, angles, speeds, settings.athlete_height_m)

    summary = analyzer.summarize(angles, speeds, pose.fps)
    summary["series_preview"] = _downsample_for_summary(angles)
    if extra:
        summary["extra"] = extra

    return AnalysisResult(
        fps=pose.fps,
        frame_count=pose.num_frames,
        duration_seconds=round(pose.duration_seconds, 2),
        angles=angles,
        speeds=speeds,
        summary=summary,
        extra=extra,
    )


def save_series(npz_path: str, result: AnalysisResult) -> None:
    """Persist the full per-frame series for later comparison."""
    Path(npz_path).parent.mkdir(parents=True, exist_ok=True)
    from app.utils import to_jsonable

    payload: dict[str, np.ndarray] = {"__fps__": np.array([result.fps], dtype=np.float64)}
    for ch, arr in result.angles.items():
        payload[f"angle__{ch}"] = arr.astype(np.float32)
    for side, arr in result.speeds.items():
        payload[f"speed__{side}"] = arr.astype(np.float32)
    payload["__extra__"] = np.array(json.dumps(to_jsonable(result.extra or {})))
    np.savez_compressed(npz_path, **payload)


def result_to_video_analysis(
    result: AnalysisResult,
    analyzer: BaseAnalyzer,
    *,
    label: str,
    metric_value: float | None,
    metric_unit: str | None,
) -> VideoAnalysis:
    """Build a :class:`VideoAnalysis` directly from an in-memory result
    (used by the public 'try it free' path, which skips persistence).
    """
    return VideoAnalysis(
        fps=result.fps,
        angles=result.angles,
        speeds=result.speeds,
        label=label,
        metric_value=metric_value,
        metric_unit=metric_unit,
        dominant_side=analyzer.dominant_side(result.speeds),
        key_event=analyzer.detect_key_event(result.angles, result.speeds, result.fps),
        extra=result.extra or {},
    )


def load_video_analysis(
    npz_path: str,
    *,
    label: str,
    metric_value: float | None,
    metric_unit: str | None,
    analyzer: BaseAnalyzer,
) -> VideoAnalysis:
    """Reconstruct a :class:`VideoAnalysis` from a persisted .npz file."""
    data = np.load(npz_path, allow_pickle=False)
    fps = float(data["__fps__"][0]) if "__fps__" in data else 30.0
    angles: dict[str, np.ndarray] = {}
    speeds: dict[str, np.ndarray] = {}
    for key in data.files:
        if key.startswith("angle__"):
            angles[key[len("angle__"):]] = data[key].astype(np.float64)
        elif key.startswith("speed__"):
            speeds[key[len("speed__"):]] = data[key].astype(np.float64)

    extra: dict[str, Any] = {}
    if "__extra__" in data:
        try:
            extra = json.loads(str(data["__extra__"]))
        except (ValueError, TypeError):
            extra = {}

    dominant = analyzer.dominant_side(speeds)
    key_event = analyzer.detect_key_event(angles, speeds, fps)
    return VideoAnalysis(
        fps=fps,
        angles=angles,
        speeds=speeds,
        label=label,
        metric_value=metric_value,
        metric_unit=metric_unit,
        dominant_side=dominant,
        key_event=key_event,
        extra=extra,
    )
