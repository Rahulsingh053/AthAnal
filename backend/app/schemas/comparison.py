"""Comparison schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ProcessingStatus
from app.schemas.video import VideoRead


class ComparisonCreate(BaseModel):
    baseline_video_id: int
    target_video_id: int
    title: str = Field(default="", max_length=255)


class ComparisonRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    baseline_video_id: int
    target_video_id: int
    title: str
    status: ProcessingStatus
    error_message: str | None
    report: dict[str, Any] | None
    created_at: datetime
    baseline_video: VideoRead | None = None
    target_video: VideoRead | None = None
