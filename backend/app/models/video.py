"""Uploaded performance video and its analysis state."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ProcessingStatus

if TYPE_CHECKING:
    from app.models.sport import Sport
    from app.models.user import User


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    sport_id: Mapped[int] = mapped_column(ForeignKey("sports.id"), index=True, nullable=False)

    # User-supplied context, e.g. "124 kph" or "Pre-season run-up".
    label: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Optional measured metric the athlete provides (e.g. ball speed in kph).
    metric_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    metric_unit: Mapped[str | None] = mapped_column(String(32), nullable=True)

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)

    status: Mapped[ProcessingStatus] = mapped_column(
        String(20), default=ProcessingStatus.PENDING, nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis_progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Probe metadata
    fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    frame_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Compact analysis summary (per-frame pose series stored on disk, summary here).
    analysis_summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    analysis_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="videos")
    sport: Mapped["Sport"] = relationship()
