from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional, List
import json
from datetime import datetime

from database import get_db
from models import Job, JobStatus, JobPlatform
from services.ats import check_ats, suggest_additions
from services.cv_generator import generate_cv
from services.applier import auto_apply, detect_platform
from services.notifier import notify_applied, notify_error

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class ATSCheck(BaseModel):
    jd_text: str
    cv_text: Optional[str] = None

class CVGenerate(BaseModel):
    company: str
    jd: Optional[str] = ""
    missing: Optional[List[str]] = []

class JobCreate(BaseModel):
    url: str
    title: str
    company: str
    location: Optional[str] = ""
    jd_text: Optional[str] = ""
    auto_apply: Optional[bool] = True

class JobATS(BaseModel):
    jd_text: str
    cv_text: Optional[str] = None

class JobApply(BaseModel):
    dry_run: Optional[bool] = False


@router.post("/ats-check")
async def standalone_ats(data: ATSCheck):
    """Standalone ATS check without a job_id."""
    try:
        with open("/app/cv.md") as f:
            cv_text = f.read()
    except FileNotFoundError:
        cv_text = data.cv_text or ""
    result = check_ats(data.jd_text, cv_text)
    return result


@router.post("/generate-cv")
async def standalone_generate_cv(data: CVGenerate):
    """Standalone CV generation."""
    result = generate_cv(
        company=data.company,
        role="",
        jd=data.jd,
        extra_keywords=data.missing,
    )
    return result


@router.get("/")
async def list_jobs(
    status: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    q = select(Job).order_by(desc(Job.created_at)).limit(limit)
    if status:
        q = q.where(Job.status == status)
    result = await db.execute(q)
    jobs = result.scalars().all()
    return [_job_to_dict(j) for j in jobs]


@router.post("/")
async def create_job(data: JobCreate, db: AsyncSession = Depends(get_db)):
    # Check duplicate
    existing = await db.execute(select(Job).where(Job.url == data.url))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Job already exists")

    job = Job(
        url=data.url,
        title=data.title,
        company=data.company,
        location=data.location,
        jd_text=data.jd_text,
        auto_apply=data.auto_apply,
        platform=detect_platform(data.url),
        status=JobStatus.discovered,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return _job_to_dict(job)


@router.post("/{job_id}/ats")
async def run_ats(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await _get_job(job_id, db)

    # Read Andrea's base CV
    try:
        with open("/app/cv.md") as f:
            cv_text = f.read()
    except FileNotFoundError:
        cv_text = ""  # Use empty fallback

    result = check_ats(job.jd_text or "", cv_text)
    job.ats_score   = result["score"]
    job.ats_missing = json.dumps([m["keyword"] for m in result["missing"]])
    job.status      = JobStatus.ats_checked
    await db.commit()

    return {**_job_to_dict(job), "ats_result": result}


@router.post("/{job_id}/generate-cv")
async def generate_cv_for_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await _get_job(job_id, db)

    missing = json.loads(job.ats_missing or "[]")
    extras  = suggest_additions([{"keyword": k, "freq": 1} for k in missing])

    result = generate_cv(
        company=job.company,
        role=job.title,
        jd=job.jd_text or "",
        extra_keywords=extras,
    )
    job.cv_docx_path = result["docx_path"]
    job.cv_pdf_path  = result["pdf_path"]
    job.status       = JobStatus.cv_generated
    await db.commit()

    return {**_job_to_dict(job), "cv": result}


@router.post("/{job_id}/apply")
async def apply_to_job(
    job_id: int,
    data: JobApply,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    job = await _get_job(job_id, db)

    if not job.cv_pdf_path:
        raise HTTPException(400, "Generate CV first")

    background_tasks.add_task(_do_apply, job_id, data.dry_run)
    return {"message": "Application queued", "job_id": job_id}


@router.post("/pipeline")
async def full_pipeline(
    data: JobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """One-shot: create job → ATS → generate CV → apply."""
    # Create
    existing = await db.execute(select(Job).where(Job.url == data.url))
    job = existing.scalar_one_or_none()
    if not job:
        job = Job(
            url=data.url, title=data.title, company=data.company,
            location=data.location, jd_text=data.jd_text,
            auto_apply=data.auto_apply, platform=detect_platform(data.url),
            status=JobStatus.discovered,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

    background_tasks.add_task(_run_pipeline, job.id)
    return {"message": "Pipeline started", "job_id": job.id}


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job))
    jobs = result.scalars().all()
    return {
        "total":       len(jobs),
        "applied":     sum(1 for j in jobs if j.status == JobStatus.applied),
        "pending":     sum(1 for j in jobs if j.status in [JobStatus.discovered, JobStatus.ats_checked, JobStatus.cv_generated]),
        "rejected":    sum(1 for j in jobs if j.status == JobStatus.rejected),
        "interviews":  sum(1 for j in jobs if j.status == JobStatus.interview),
        "avg_ats":     round(sum(j.ats_score or 0 for j in jobs) / max(len(jobs), 1), 1),
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_job(job_id: int, db: AsyncSession) -> Job:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    return job


async def _do_apply(job_id: int, dry_run: bool):
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        job = await _get_job(job_id, db)
        result = await auto_apply(job.url, job.cv_pdf_path, dry_run=dry_run)
        if result["success"]:
            job.status     = JobStatus.applied
            job.applied_at = datetime.utcnow()
            await notify_applied(job.company, job.title, job.url, job.ats_score or 0)
        else:
            job.notes = result["message"]
            await notify_error(job.company, job.title, result["message"])
        await db.commit()


async def _run_pipeline(job_id: int):
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        job = await _get_job(job_id, db)

        # ATS
        try:
            with open("/app/cv.md") as f:
                cv_text = f.read()
        except FileNotFoundError:
            cv_text = ""
        ats = check_ats(job.jd_text or "", cv_text)
        job.ats_score   = ats["score"]
        job.ats_missing = json.dumps([m["keyword"] for m in ats["missing"]])
        job.status      = JobStatus.ats_checked
        await db.commit()

        # Generate CV
        missing = json.loads(job.ats_missing or "[]")
        extras  = suggest_additions([{"keyword": k, "freq": 1} for k in missing])
        cv_result = generate_cv(company=job.company, role=job.title,
                                jd=job.jd_text or "", extra_keywords=extras)
        job.cv_docx_path = cv_result["docx_path"]
        job.cv_pdf_path  = cv_result["pdf_path"]
        job.status       = JobStatus.cv_generated
        await db.commit()

        # Apply
        if job.auto_apply:
            result = await auto_apply(job.url, job.cv_pdf_path)
            if result["success"]:
                job.status     = JobStatus.applied
                job.applied_at = datetime.utcnow()
                await notify_applied(job.company, job.title, job.url, job.ats_score or 0)
            else:
                job.notes = result["message"]
                await notify_error(job.company, job.title, result["message"])
            await db.commit()


def _job_to_dict(j: Job) -> dict:
    return {
        "id":           j.id,
        "title":        j.title,
        "company":      j.company,
        "location":     j.location,
        "url":          j.url,
        "platform":     j.platform,
        "ats_score":    j.ats_score,
        "status":       j.status,
        "applied_at":   j.applied_at.isoformat() if j.applied_at else None,
        "created_at":   j.created_at.isoformat() if j.created_at else None,
        "cv_pdf_path":  j.cv_pdf_path,
        "notes":        j.notes,
    }
