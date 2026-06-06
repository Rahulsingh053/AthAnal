"""A comparison between two of an athlete's videos (baseline vs target)."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ProcessingStatus

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.video import Video


class Comparison(Base):
    __tablename__ = "comparisons"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    baseline_video_id: Mapped[int] = mapped_column(ForeignKey("videos.id"), nullable=False)
    target_video_id: Mapped[int] = mapped_column(ForeignKey("videos.id"), nullable=False)

    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    status: Mapped[ProcessingStatus] = mapped_column(
        String(20), default=ProcessingStatus.PENDING, nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Full comparison report (insights, per-joint deltas, timing, scores).
    report: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="comparisons")
    baseline_video: Mapped["Video"] = relationship(foreign_keys=[baseline_video_id])
    target_video: Mapped["Video"] = relationship(foreign_keys=[target_video_id])
