from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/career_autopilot"

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None

    # Discord
    DISCORD_WEBHOOK: str = "https://discord.com/api/webhooks/1508406384830709822/Z8kN6TjvvVqr5J3KxbOWqC4xSENQyHhFLri8lz8gJGhHwjUcSmMEymr6wId_1QIn2-Wf"

    # LinkedIn credentials
    LINKEDIN_EMAIL: Optional[str] = None
    LINKEDIN_PASSWORD: Optional[str] = None

    # App
    SECRET_KEY: str = "change-me-in-production"
    FRONTEND_URL: str = "http://localhost:3000"
    MAX_APPLICATIONS_PER_DAY: int = 20

    # Andrea's profile (pre-filled for Workday/forms)
    CANDIDATE_NAME: str = "Andrea Estrella"
    CANDIDATE_EMAIL: str = "aestrellaoliva@gmail.com"
    CANDIDATE_PHONE: str = "(779)390-4034"
    CANDIDATE_CITY: str = "Chicago"
    CANDIDATE_STATE: str = "IL"
    CANDIDATE_ZIP: str = "60601"
    CANDIDATE_LINKEDIN: str = "linkedin.com/in/andreaa-estrellaa"
    CANDIDATE_GITHUB: str = "github.com/andreastaar"

    class Config:
        env_file = ".env"

settings = Settings()
