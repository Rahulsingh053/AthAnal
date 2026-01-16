"""Database engine, session factory and declarative base."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# SQLite needs a special flag for multi-threaded access (FastAPI runs threaded).
connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. For production, replace with Alembic migrations."""
    # Import models so they are registered on the metadata before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_columns()


def _migrate_sqlite_columns() -> None:
    """Add columns introduced after initial deploy (SQLite has no ALTER IF NOT EXISTS)."""
    if not settings.database_url.startswith("sqlite"):
        return

    from sqlalchemy import inspect, text

    with engine.begin() as conn:
        inspector = inspect(conn)
        if "videos" not in inspector.get_table_names():
            return
        columns = {col["name"] for col in inspector.get_columns("videos")}
        if "analysis_progress" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE videos ADD COLUMN analysis_progress "
                    "INTEGER NOT NULL DEFAULT 0"
                )
            )
