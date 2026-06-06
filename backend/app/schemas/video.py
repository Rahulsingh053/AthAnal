"""Video schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import ProcessingStatus
from app.schemas.sport import SportRead


class VideoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    sport_id: int
    label: str
    notes: str
    metric_value: float | None
    metric_unit: str | None
    original_filename: str
    status: ProcessingStatus
    error_message: str | None
    analysis_progress: int
    fps: float | None
    frame_count: int | None
    duration_seconds: float | None
    analysis_summary: dict[str, Any] | None
    created_at: datetime
    sport: SportRead | None = None
