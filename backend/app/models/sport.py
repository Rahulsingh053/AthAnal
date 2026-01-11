"""Sport model. Each sport maps to an analysis profile (plugin key)."""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Sport(Base):
    __tablename__ = "sports"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Key that selects the analyzer plugin (e.g. "bowling", "generic").
    analyzer_key: Mapped[str] = mapped_column(String(64), default="generic", nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
