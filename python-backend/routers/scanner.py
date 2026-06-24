from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional

from database import get_db
from models import Job, JobStatus
from services.scanner import scan_all, DEFAULT_KEYWORDS
from services.applier import detect_platform

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


class ScanRequest(BaseModel):
    keywords: Optional[List[str]] = None
    limit_per_query: Optional[int] = 10
    auto_pipeline: Optional[bool] = True


@router.post("/run")
async def run_scan(
    data: ScanRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Scan LinkedIn for new jobs and optionally auto-pipeline them."""
    background_tasks.add_task(
        _scan_and_queue,
        data.keywords or DEFAULT_KEYWORDS,
        data.limit_per_query,
        data.auto_pipeline,
    )
    return {"message": "Scan started in background"}


@router.get("/keywords")
async def get_default_keywords():
    return {"keywords": DEFAULT_KEYWORDS}


async def _scan_and_queue(keywords: List[str], limit: int, auto_pipeline: bool):
    from database import AsyncSessionLocal
    from routers.jobs import _run_pipeline
    from services.notifier import notify_discord

    jobs_found = await scan_all(keywords, limit_per_query=limit)

    async with AsyncSessionLocal() as db:
        new_count = 0
        for job_data in jobs_found:
            existing = await db.execute(select(Job).where(Job.url == job_data["url"]))
            if existing.scalar_one_or_none():
                continue

            job = Job(
                url=job_data["url"],
                title=job_data["title"],
                company=job_data["company"],
                location=job_data.get("location", ""),
                platform=detect_platform(job_data["url"]),
                status=JobStatus.discovered,
                auto_apply=auto_pipeline,
            )
            db.add(job)
            await db.commit()
            await db.refresh(job)
            new_count += 1

            if auto_pipeline:
                await _run_pipeline(job.id)

        await notify_discord(
            f"🔍 Scan complete — **{new_count} new jobs** found and queued",
            title="Scanner Report"
        )
