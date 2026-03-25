"""Video upload, listing and retrieval routes."""
from __future__ import annotations

from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi import Response
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import ProcessingStatus, Sport, User, Video
from app.schemas.video import VideoRead
from app.services import storage
from app.tasks import process_video_task

router = APIRouter()


def _get_owned_video(video_id: int, user: User, db: Session) -> Video:
    video = db.get(Video, video_id)
    if video is None or video.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    return video


@router.post("", response_model=VideoRead, status_code=status.HTTP_201_CREATED)
def upload_video(
    background_tasks: BackgroundTasks,
    sport_id: int = Form(...),
    label: str = Form(""),
    notes: str = Form(""),
    metric_value: float | None = Form(None),
    metric_unit: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Video:
    sport = db.get(Sport, sport_id)
    if sport is None or not sport.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sport")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in storage.ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: "
            + ", ".join(sorted(storage.ALLOWED_VIDEO_EXTENSIONS)),
        )

    video = Video(
        owner_id=current_user.id,
        sport_id=sport_id,
        label=label,
        notes=notes,
        metric_value=metric_value,
        metric_unit=metric_unit,
        original_filename=file.filename or "video",
        storage_path="",
        status=ProcessingStatus.PENDING,
    )
    db.add(video)
    db.flush()  # assign an id

    dest = storage.videos_dir() / f"{video.id}{ext or '.mp4'}"
    save_failed = False
    try:
        storage.save_upload(file, dest)
    except OSError:
        save_failed = True
    if save_failed:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not store the uploaded file.",
        )

    video.storage_path = str(dest)
    db.commit()
    db.refresh(video)

    background_tasks.add_task(process_video_task, video.id)
    return video


@router.get("/analytics")
def get_video_analytics(
    sport_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Return per-joint mean angles across the user's completed videos for progress tracking."""
    q = (
        select(Video)
        .where(
            Video.owner_id == current_user.id,
            Video.status == ProcessingStatus.COMPLETED,
        )
        .order_by(Video.created_at.asc())
    )
    if sport_id is not None:
        q = q.where(Video.sport_id == sport_id)

    videos = list(db.scalars(q))
    result = []
    for v in videos:
        summary = v.analysis_summary or {}
        result.append(
            {
                "id": v.id,
                "label": v.label or v.original_filename,
                "created_at": v.created_at.isoformat(),
                "metric_value": v.metric_value,
                "metric_unit": v.metric_unit,
                "mean_angles": summary.get("mean_angles", {}),
                "range_of_motion": summary.get("range_of_motion", {}),
                "sport": v.sport.name if v.sport else None,
                "sport_id": v.sport_id,
            }
        )
    return result


@router.get("", response_model=list[VideoRead])
def list_videos(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[Video]:
    return list(
        db.scalars(
            select(Video)
            .where(Video.owner_id == current_user.id)
            .order_by(Video.created_at.desc())
        )
    )


@router.get("/{video_id}", response_model=VideoRead)
def get_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Video:
    return _get_owned_video(video_id, current_user, db)


@router.get("/{video_id}/file")
def get_video_file(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    video = _get_owned_video(video_id, current_user, db)
    if not video.storage_path or not Path(video.storage_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(video.storage_path, filename=video.original_filename)


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    video = _get_owned_video(video_id, current_user, db)
    storage.remove_file(video.storage_path)
    storage.remove_file(video.analysis_path)
    db.delete(video)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
