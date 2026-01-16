"""Seed the sport catalog. Idempotent - safe to run on every startup."""
from __future__ import annotations

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import Sport

DEFAULT_SPORTS = [
    {
        "slug": "cricket-bowling",
        "name": "Cricket Bowling",
        "description": "Compare two deliveries to see what changed in your bowling action.",
        "analyzer_key": "bowling",
    },
    {
        "slug": "sprint-running",
        "name": "Sprint / Running",
        "description": "Compare running form across sessions.",
        "analyzer_key": "generic",
    },
    {
        "slug": "long-jump",
        "name": "Long Jump",
        "description": "Compare approach and take-off mechanics.",
        "analyzer_key": "generic",
    },
    {
        "slug": "javelin-throw",
        "name": "Javelin Throw",
        "description": "Compare throwing action across attempts.",
        "analyzer_key": "generic",
    },
    {
        "slug": "general-movement",
        "name": "General Movement",
        "description": "Sport-agnostic movement comparison for any activity.",
        "analyzer_key": "generic",
    },
]


def seed_sports() -> None:
    db = SessionLocal()
    try:
        for data in DEFAULT_SPORTS:
            exists = db.scalar(select(Sport).where(Sport.slug == data["slug"]))
            if exists is None:
                db.add(Sport(**data))
        db.commit()
    finally:
        db.close()
