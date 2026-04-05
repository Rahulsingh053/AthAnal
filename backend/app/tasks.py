"""Background processing tasks.



Currently executed via FastAPI BackgroundTasks (in-process). The functions take

only primitive ids and manage their own DB session, so they can be moved to a

Celery/RQ worker later with zero changes to call sites.

"""

from __future__ import annotations



import logging

import os

from collections.abc import Callable

from concurrent.futures import ThreadPoolExecutor



from app.analysis.ai_coaching import generate_coaching_report
from app.analysis.comparator import compare

from app.analysis.engine import (
    analyze_video,
    load_video_analysis,
    result_to_video_analysis,
    save_series,
)

from app.analysis.registry import get_analyzer

from app.core.database import SessionLocal

from app.models import Comparison, ProcessingStatus, Video

from app.services import storage

from app.services.try_jobs import try_job_store

from app.utils import to_jsonable



logger = logging.getLogger(__name__)



TRY_MAX_FRAMES = 450





def _video_progress_callback(db, video_id: int) -> Callable[[int, int], None]:

    last_reported = [-1]



    def on_progress(current: int, total: int) -> None:

        if total <= 0:

            return

        pct = int(current * 100 / total)

        if pct < last_reported[0] + 3 and pct < 100:

            return

        last_reported[0] = pct

        video = db.get(Video, video_id)

        if video is None or video.status != ProcessingStatus.PROCESSING:

            return

        video.analysis_progress = pct

        db.commit()



    return on_progress





def process_video_task(video_id: int) -> None:

    db = SessionLocal()

    try:

        video = db.get(Video, video_id)

        if video is None:

            return

        video.status = ProcessingStatus.PROCESSING

        video.error_message = None

        video.analysis_progress = 0

        db.commit()



        analyzer_key = video.sport.analyzer_key if video.sport else "generic"

        result = analyze_video(

            video.storage_path,

            analyzer_key,

            on_progress=_video_progress_callback(db, video_id),

        )



        npz_path = storage.analysis_path_for(video.id)

        save_series(str(npz_path), result)



        video = db.get(Video, video_id)

        if video is None:

            return

        video.fps = result.fps

        video.frame_count = result.frame_count

        video.duration_seconds = result.duration_seconds

        video.analysis_summary = to_jsonable(result.summary)

        video.analysis_path = str(npz_path)

        video.analysis_progress = 100

        video.status = ProcessingStatus.COMPLETED

        db.commit()

    except Exception as exc:  # noqa: BLE001 - record failure for the user

        logger.exception("Video analysis failed for video_id=%s", video_id)

        db.rollback()

        video = db.get(Video, video_id)

        if video is not None:

            video.status = ProcessingStatus.FAILED

            video.error_message = str(exc)[:1000]

            db.commit()

    finally:

        db.close()





def _analyze_try_slot(

    job_id: str,

    slot: str,

    video_path: str,

    analyzer_key: str,

) -> object:

    last_pct = [-1]



    def on_progress(current: int, total: int) -> None:

        if total <= 0:

            return

        pct = int(current * 45 / total)

        if pct >= last_pct[0] + 2 or pct >= 45:

            try_job_store.update_slot(job_id, slot, pct)  # type: ignore[arg-type]

            last_pct[0] = pct



    return analyze_video(

        video_path,

        analyzer_key,

        max_frames=TRY_MAX_FRAMES,

        on_progress=on_progress,

    )





def process_try_job(job_id: str) -> None:

    job = try_job_store.get(job_id)

    if job is None:

        return



    try:

        try_job_store.set_message(job_id, "Analysing both videos in parallel…", progress=5)

        with ThreadPoolExecutor(max_workers=2) as pool:

            future_baseline = pool.submit(

                _analyze_try_slot,

                job_id,

                "baseline",

                job.baseline_path,

                job.analyzer_key,

            )

            future_target = pool.submit(

                _analyze_try_slot,

                job_id,

                "target",

                job.target_path,

                job.analyzer_key,

            )

            r1 = future_baseline.result()

            r2 = future_target.result()



        try_job_store.set_message(job_id, "Comparing movements…", progress=95)

        analyzer = get_analyzer(job.analyzer_key)

        ba = result_to_video_analysis(

            r1,

            analyzer,

            label=job.baseline_label,

            metric_value=job.baseline_metric,

            metric_unit=job.metric_unit,

        )

        ta = result_to_video_analysis(

            r2,

            analyzer,

            label=job.target_label,

            metric_value=job.target_metric,

            metric_unit=job.metric_unit,

        )

        report = compare(ba, ta, analyzer)

        sport_name = analyzer.display_name
        ai = generate_coaching_report(report, sport_name, job.analyzer_key)
        if ai:
            report["ai_coaching"] = ai

        try_job_store.complete(job_id, to_jsonable(report))

    except Exception as exc:  # noqa: BLE001

        logger.exception("Try job failed job_id=%s", job_id)

        try_job_store.fail(job_id, str(exc))

    finally:

        for path in (job.baseline_path, job.target_path):

            if path:

                try:

                    os.unlink(path)

                except OSError:

                    pass





def process_comparison_task(comparison_id: int) -> None:

    db = SessionLocal()

    try:

        comparison = db.get(Comparison, comparison_id)

        if comparison is None:

            return

        comparison.status = ProcessingStatus.PROCESSING

        comparison.error_message = None

        db.commit()



        baseline = db.get(Video, comparison.baseline_video_id)

        target = db.get(Video, comparison.target_video_id)

        if baseline is None or target is None:

            raise ValueError("One or both videos no longer exist.")

        if not baseline.analysis_path or not target.analysis_path:

            raise ValueError("Both videos must finish analysis before comparison.")



        analyzer = get_analyzer(baseline.sport.analyzer_key if baseline.sport else "generic")

        baseline_analysis = load_video_analysis(

            baseline.analysis_path,

            label=baseline.label or f"Video {baseline.id}",

            metric_value=baseline.metric_value,

            metric_unit=baseline.metric_unit,

            analyzer=analyzer,

        )

        target_analysis = load_video_analysis(

            target.analysis_path,

            label=target.label or f"Video {target.id}",

            metric_value=target.metric_value,

            metric_unit=target.metric_unit,

            analyzer=analyzer,

        )



        report = compare(baseline_analysis, target_analysis, analyzer)

        sport_name = baseline.sport.name if baseline.sport else analyzer.display_name
        ai = generate_coaching_report(report, sport_name, analyzer.key)
        if ai:
            report["ai_coaching"] = ai

        comparison.report = to_jsonable(report)

        comparison.status = ProcessingStatus.COMPLETED

        db.commit()

    except Exception as exc:  # noqa: BLE001

        logger.exception("Comparison failed for comparison_id=%s", comparison_id)

        db.rollback()

        comparison = db.get(Comparison, comparison_id)

        if comparison is not None:

            comparison.status = ProcessingStatus.FAILED

            comparison.error_message = str(exc)[:1000]

            db.commit()

    finally:

        db.close()

