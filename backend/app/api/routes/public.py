"""Public, no-login routes: a single free comparison so people can try PeakForm."""

from __future__ import annotations



import os

import shutil

import tempfile

from pathlib import Path



from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status

from sqlalchemy.orm import Session



from app.core.database import get_db

from app.models import Sport

from app.services import storage

from app.services.try_jobs import try_job_store

from app.tasks import process_try_job



router = APIRouter()





def _save_temp(upload: UploadFile) -> str:

    ext = Path(upload.filename or "").suffix.lower()

    if ext not in storage.ALLOWED_VIDEO_EXTENSIONS:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=f"Unsupported file type '{ext}'.",

        )

    fd, path = tempfile.mkstemp(suffix=ext)

    with os.fdopen(fd, "wb") as buffer:

        shutil.copyfileobj(upload.file, buffer)

    return path





@router.post("/try")

def start_try_comparison(

    background_tasks: BackgroundTasks,

    baseline: UploadFile = File(...),

    target: UploadFile = File(...),

    sport_id: int | None = Form(None),

    baseline_label: str = Form("Baseline"),

    target_label: str = Form("Target"),

    baseline_metric: float | None = Form(None),

    target_metric: float | None = Form(None),

    metric_unit: str | None = Form(None),

    db: Session = Depends(get_db),

) -> dict:

    """Upload two videos and start an async comparison job.



    Poll ``GET /public/try/{job_id}`` for progress and the final report.

    """

    analyzer_key = "bowling"

    if sport_id is not None:

        sport = db.get(Sport, sport_id)

        if sport is not None:

            analyzer_key = sport.analyzer_key



    baseline_path = _save_temp(baseline)

    target_path = _save_temp(target)



    job = try_job_store.create(

        baseline_path=baseline_path,

        target_path=target_path,

        analyzer_key=analyzer_key,

        baseline_label=baseline_label,

        target_label=target_label,

        baseline_metric=baseline_metric,

        target_metric=target_metric,

        metric_unit=metric_unit,

        message="Upload complete — starting analysis…",

        progress=2,

    )

    background_tasks.add_task(process_try_job, job.job_id)

    return {"job_id": job.job_id}





@router.get("/try/{job_id}")

def get_try_job(job_id: str) -> dict:

    """Return progress and, when finished, the comparison report."""

    job = try_job_store.get(job_id)

    if job is None:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return job.to_dict()

