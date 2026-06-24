"""Discord + notifications for job applications."""
import httpx
from config import settings

async def notify_discord(message: str, title: str = "🤖 career-autopilot", color: int = 5814783):
    payload = {
        "embeds": [{
            "title": title,
            "description": message,
            "color": color,
            "footer": {"text": "career-autopilot · running in cloud ☁️"}
        }]
    }
    async with httpx.AsyncClient() as client:
        try:
            await client.post(settings.DISCORD_WEBHOOK, json=payload, timeout=5)
        except Exception:
            pass

async def notify_applied(company: str, role: str, url: str, ats_score: float):
    await notify_discord(
        f"**Applied** to **{company}** — {role}\n"
        f"ATS Score: **{ats_score}%**\n"
        f"URL: {url}",
        title="✅ New Application",
        color=0x00C851
    )

async def notify_error(company: str, role: str, error: str):
    await notify_discord(
        f"**Failed** to apply to **{company}** — {role}\n"
        f"Error: {error}",
        title="❌ Application Failed",
        color=0xFF4444
    )
