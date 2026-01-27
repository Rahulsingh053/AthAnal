"""Pose extraction from a video file.

The heavy dependencies (OpenCV + MediaPipe) are imported lazily inside the
methods so that importing this module (and the API) never requires them.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from app.analysis.landmarks import NUM_LANDMARKS


@dataclass
class PoseSequence:
    """Per-frame pose data for one video.

    landmarks:  float32 array (T, 33, 3) of normalized x, y, z.
    visibility: float32 array (T, 33) in [0, 1].
    fps:        frames per second of the analyzed stream.
    """

    landmarks: np.ndarray
    visibility: np.ndarray
    fps: float
    frame_width: int = 0
    frame_height: int = 0

    @property
    def num_frames(self) -> int:
        return int(self.landmarks.shape[0])

    @property
    def duration_seconds(self) -> float:
        if self.fps <= 0:
            return 0.0
        return self.num_frames / self.fps


class PoseExtractor:
    """Runs MediaPipe Pose over a video and returns a :class:`PoseSequence`."""

    def __init__(
        self,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
        max_frames: int = 900,
        max_frame_width: int = 640,
    ) -> None:
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self.max_frames = max_frames
        self.max_frame_width = max_frame_width

    def extract(
        self,
        video_path: str,
        on_progress: Callable[[int, int], None] | None = None,
    ) -> PoseSequence:
        import cv2  # lazy import
        import mediapipe as mp  # lazy import

        capture = cv2.VideoCapture(video_path)
        if not capture.isOpened():
            raise ValueError(f"Could not open video: {video_path}")

        src_fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        frame_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        frame_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        # If a clip is very long, sample frames evenly to stay under max_frames.
        stride = 1
        if total > self.max_frames > 0:
            stride = int(np.ceil(total / self.max_frames))
        effective_fps = src_fps / stride if stride > 0 else src_fps

        landmarks_seq: list[np.ndarray] = []
        visibility_seq: list[np.ndarray] = []
        last_reported_pct = -1

        def _report_progress(frame_number: int) -> None:
            nonlocal last_reported_pct
            if on_progress is None or total <= 0:
                return
            pct = int(min(frame_number, total) * 100 / total)
            if pct >= last_reported_pct + 2 or pct == 100:
                on_progress(min(frame_number, total), total)
                last_reported_pct = pct

        mp_pose = mp.solutions.pose
        with mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        ) as pose:
            frame_idx = 0
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                if frame_width == 0 or frame_height == 0:
                    frame_height, frame_width = frame.shape[0], frame.shape[1]
                if (
                    self.max_frame_width > 0
                    and frame_width > self.max_frame_width
                ):
                    scale = self.max_frame_width / frame_width
                    frame = cv2.resize(
                        frame,
                        (self.max_frame_width, int(frame_height * scale)),
                        interpolation=cv2.INTER_AREA,
                    )
                if frame_idx % stride == 0:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    rgb.flags.writeable = False
                    result = pose.process(rgb)

                    coords = np.zeros((NUM_LANDMARKS, 3), dtype=np.float32)
                    vis = np.zeros((NUM_LANDMARKS,), dtype=np.float32)
                    if result.pose_landmarks:
                        for i, lm in enumerate(result.pose_landmarks.landmark):
                            coords[i] = (lm.x, lm.y, lm.z)
                            vis[i] = lm.visibility
                    landmarks_seq.append(coords)
                    visibility_seq.append(vis)
                frame_idx += 1
                _report_progress(frame_idx)

        capture.release()

        if not landmarks_seq:
            raise ValueError("No frames could be read from the video.")

        landmarks = np.stack(landmarks_seq, axis=0)
        visibility = np.stack(visibility_seq, axis=0)
        return PoseSequence(
            landmarks=landmarks,
            visibility=visibility,
            fps=effective_fps,
            frame_width=frame_width or 1280,
            frame_height=frame_height or 720,
        )
