from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, Enum
from sqlalchemy.sql import func
import enum
from database import Base

class JobStatus(str, enum.Enum):
    discovered   = "discovered"
    ats_checked  = "ats_checked"
    cv_generated = "cv_generated"
    applied      = "applied"
    rejected     = "rejected"
    interview    = "interview"
    skipped      = "skipped"

class JobPlatform(str, enum.Enum):
    linkedin   = "linkedin"
    workday    = "workday"
    greenhouse = "greenhouse"
    lever      = "lever"
    manual     = "manual"
    other      = "other"

class Job(Base):
    __tablename__ = "jobs"

    id            = Column(Integer, primary_key=True, index=True)
    title         = Column(String(255), nullable=False)
    company       = Column(String(255), nullable=False)
    location      = Column(String(255))
    url           = Column(String(1024), unique=True, nullable=False)
    platform      = Column(Enum(JobPlatform), default=JobPlatform.manual)
    jd_text       = Column(Text)
    ats_score     = Column(Float)
    ats_missing   = Column(Text)        # JSON list of missing keywords
    cv_docx_path  = Column(String(512))
    cv_pdf_path   = Column(String(512))
    status        = Column(Enum(JobStatus), default=JobStatus.discovered)
    auto_apply    = Column(Boolean, default=True)
    applied_at    = Column(DateTime(timezone=True))
    notes         = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

class Settings(Base):
    __tablename__ = "app_settings"

    key   = Column(String(100), primary_key=True)
    value = Column(Text)
