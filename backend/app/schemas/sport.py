"""Sport schemas."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class SportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    description: str
    analyzer_key: str
    is_active: bool
