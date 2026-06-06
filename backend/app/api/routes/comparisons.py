"""Comparison creation and retrieval routes."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Comparison, ProcessingStatus, User, Video
from app.schemas.comparison import ComparisonCreate, ComparisonRead
from app.tasks import process_comparison_task

router = APIRouter()


def _require_ready_video(video_id: int, user: User, db: Session) -> Video:
    video = db.get(Video, video_id)
    if video is None or video.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Video {video_id} not found"
        )
    if video.status != ProcessingStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Video {video_id} has not finished analysis (status: {video.status}).",
        )
    return video


@router.post("", response_model=ComparisonRead, status_code=status.HTTP_201_CREATED)
def create_comparison(
    payload: ComparisonCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Comparison:
    if payload.baseline_video_id == payload.target_video_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pick two different videos to compare.",
        )
    baseline = _require_ready_video(payload.baseline_video_id, current_user, db)
    target = _require_ready_video(payload.target_video_id, current_user, db)
    if baseline.sport_id != target.sport_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both videos must be of the same sport to compare.",
        )

    title = payload.title or f"{baseline.label or 'Baseline'} vs {target.label or 'Target'}"
    comparison = Comparison(
        owner_id=current_user.id,
        baseline_video_id=baseline.id,
        target_video_id=target.id,
        title=title,
        status=ProcessingStatus.PENDING,
    )
    db.add(comparison)
    db.commit()
    db.refresh(comparison)

    background_tasks.add_task(process_comparison_task, comparison.id)
    return comparison


@router.get("", response_model=list[ComparisonRead])
def list_comparisons(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[Comparison]:
    return list(
        db.scalars(
            select(Comparison)
            .where(Comparison.owner_id == current_user.id)
            .order_by(Comparison.created_at.desc())
        )
    )


@router.get("/{comparison_id}", response_model=ComparisonRead)
def get_comparison(
    comparison_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Comparison:
    comparison = db.get(Comparison, comparison_id)
    if comparison is None or comparison.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comparison not found"
        )
    return comparison
