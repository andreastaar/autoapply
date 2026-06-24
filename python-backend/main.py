from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import init_db
from routers import jobs, scanner
from config import settings
from services.notifier import notify_discord

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init DB
    await init_db()

    # Schedule daily scan at 8am UTC
    scheduler.add_job(
        _daily_scan,
        CronTrigger(hour=8, minute=0),
        id="daily_scan",
        replace_existing=True,
    )
    scheduler.start()

    await notify_discord("🚀 **career-autopilot** started and running in cloud!", title="System Online", color=0x00C851)
    yield

    scheduler.shutdown()


app = FastAPI(
    title="career-autopilot",
    description="Auto job applicator with ATS optimization — Andrea Estrella",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(scanner.router)


@app.get("/")
async def root():
    return {
        "service": "career-autopilot",
        "status": "running",
        "docs": "/docs",
    }

@app.get("/health")
async def health():
    return {"status": "ok"}


async def _daily_scan():
    """Run daily job scan."""
    from services.scanner import scan_all, DEFAULT_KEYWORDS
    from database import AsyncSessionLocal
    from sqlalchemy import select
    from models import Job, JobStatus
    from services.applier import detect_platform
    from routers.jobs import _run_pipeline

    jobs_found = await scan_all(DEFAULT_KEYWORDS, limit_per_query=15)
    async with AsyncSessionLocal() as db:
        new_count = 0
        for job_data in jobs_found:
            existing = await db.execute(select(Job).where(Job.url == job_data["url"]))
            if existing.scalar_one_or_none():
                continue
            job = Job(
                url=job_data["url"], title=job_data["title"],
                company=job_data["company"], location=job_data.get("location",""),
                platform=detect_platform(job_data["url"]),
                status=JobStatus.discovered, auto_apply=True,
            )
            db.add(job)
            await db.commit()
            await db.refresh(job)
            new_count += 1
            await _run_pipeline(job.id)

    await notify_discord(
        f"⏰ Daily scan complete — **{new_count} new jobs** processed",
        title="Daily Report", color=0x4A90E2
    )
