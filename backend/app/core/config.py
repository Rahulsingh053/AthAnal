"""Application configuration loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "PeakForm"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    # Security
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"

    # Database
    database_url: str = "sqlite:///./peakform.db"

    # Storage
    storage_dir: str = "./storage"

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # AI coaching (Claude API — leave blank to disable AI coaching)
    anthropic_api_key: str = ""

    # Analysis tuning
    pose_min_detection_confidence: float = 0.5
    pose_min_tracking_confidence: float = 0.5
    max_analysis_frames: int = 900
    # Downscale wide frames before pose detection (0 = disabled). Speeds analysis a lot.
    pose_max_frame_width: int = 640
    # Default bowler height (m) used to calibrate estimated release speed when
    # the athlete does not provide their own height.
    athlete_height_m: float = 1.75

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
