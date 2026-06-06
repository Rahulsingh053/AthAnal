"""In-memory state for async public Try comparisons."""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

TryJobStatus = Literal["processing", "completed", "failed"]


@dataclass
class TryJob:
    job_id: str
    status: TryJobStatus = "processing"
    progress: int = 0
    message: str = "Starting analysis…"
    baseline_progress: int = 0
    target_progress: int = 0
    report: dict[str, Any] | None = None
    error: str | None = None
    baseline_path: str = ""
    target_path: str = ""
    analyzer_key: str = "bowling"
    baseline_label: str = "Baseline"
    target_label: str = "Target"
    baseline_metric: float | None = None
    target_metric: float | None = None
    metric_unit: str | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def recompute_progress(self) -> None:
        if self.status == "completed":
            self.progress = 100
            return
        if self.status == "failed":
            return
        # Each video contributes up to 45% while running in parallel.
        self.progress = min(90, self.baseline_progress + self.target_progress)

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "baseline_progress": self.baseline_progress,
            "target_progress": self.target_progress,
            "report": self.report,
            "error": self.error,
        }


class TryJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, TryJob] = {}
        self._lock = threading.Lock()

    def create(self, **kwargs: Any) -> TryJob:
        job = TryJob(job_id=uuid.uuid4().hex, **kwargs)
        with self._lock:
            self._jobs[job.job_id] = job
        return job

    def get(self, job_id: str) -> TryJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def update_slot(self, job_id: str, slot: Literal["baseline", "target"], pct: int) -> None:
        job = self.get(job_id)
        if job is None or job.status != "processing":
            return
        with job._lock:
            if slot == "baseline":
                job.baseline_progress = min(45, pct)
            else:
                job.target_progress = min(45, pct)
            job.message = "Analysing both videos in parallel…"
            job.recompute_progress()

    def set_message(self, job_id: str, message: str, progress: int | None = None) -> None:
        job = self.get(job_id)
        if job is None:
            return
        with job._lock:
            job.message = message
            if progress is not None:
                job.progress = progress

    def complete(self, job_id: str, report: dict[str, Any]) -> None:
        job = self.get(job_id)
        if job is None:
            return
        with job._lock:
            job.status = "completed"
            job.report = report
            job.progress = 100
            job.message = "Done"
            job.baseline_progress = 45
            job.target_progress = 45

    def fail(self, job_id: str, error: str) -> None:
        job = self.get(job_id)
        if job is None:
            return
        with job._lock:
            job.status = "failed"
            job.error = error[:1000]
            job.message = "Analysis failed"


try_job_store = TryJobStore()
