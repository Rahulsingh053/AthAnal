"""Local filesystem storage. Abstracted so it can be swapped for S3 later."""
from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings

VIDEOS_SUBDIR = "videos"
ANALYSIS_SUBDIR = "analysis"

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


def videos_dir() -> Path:
    path = settings.storage_path / VIDEOS_SUBDIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def analysis_dir() -> Path:
    path = settings.storage_path / ANALYSIS_SUBDIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def analysis_path_for(video_id: int) -> Path:
    return analysis_dir() / f"video_{video_id}.npz"


def save_upload(file: UploadFile, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)


def remove_file(path: str | None) -> None:
    if not path:
        return
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass
