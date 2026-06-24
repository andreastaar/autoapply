"""
Job scanner — finds new ML/Data/AI internships from LinkedIn and other sources.
Uses Playwright to scrape job listings.
"""
import asyncio
import re
from typing import List, Dict
from playwright.async_api import async_playwright

DEFAULT_KEYWORDS = [
    "data science intern 2026",
    "machine learning intern summer 2026",
    "analytics intern 2026",
    "AI intern summer 2026",
    "data analyst intern 2026",
    "revenue operations intern 2026",
    "business intelligence intern 2026",
]

DEFAULT_LOCATIONS = ["Chicago", "Remote", "New York", "San Francisco", "Seattle"]


async def scan_linkedin(keywords: str, location: str = "United States", limit: int = 20,
                        email: str = "", password: str = "") -> List[Dict]:
    """Scrape LinkedIn job listings. Returns list of job dicts."""
    jobs = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await ctx.new_page()

        try:
            # Use public LinkedIn job search (no login required for listing)
            query = keywords.replace(' ', '%20')
            loc   = location.replace(' ', '%20')
            url = f"https://www.linkedin.com/jobs/search/?keywords={query}&location={loc}&f_TPR=r86400&f_E=1%2C2"

            await page.goto(url, timeout=30000)
            await page.wait_for_load_state("domcontentloaded")
            await asyncio.sleep(3)

            # Scroll to load more jobs
            for _ in range(3):
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(1)

            # Extract job cards
            cards = await page.query_selector_all(".job-search-card, .jobs-search__results-list li, .base-card")

            for card in cards[:limit]:
                try:
                    title_el = await card.query_selector(".base-search-card__title, h3.base-search-card__title")
                    company_el = await card.query_selector(".base-search-card__subtitle, h4.base-search-card__subtitle")
                    location_el = await card.query_selector(".job-search-card__location")
                    link_el = await card.query_selector("a.base-card__full-link, a[data-tracking-control-name]")

                    title    = (await title_el.text_content()).strip()    if title_el    else ""
                    company  = (await company_el.text_content()).strip()  if company_el  else ""
                    loc_text = (await location_el.text_content()).strip() if location_el else ""
                    link     = await link_el.get_attribute("href")        if link_el     else ""

                    if link:
                        link = link.split("?")[0]  # clean tracking params

                    if title and company and link:
                        jobs.append({
                            "title":    title,
                            "company":  company,
                            "location": loc_text,
                            "url":      link,
                            "platform": "linkedin",
                        })
                except Exception:
                    continue

        except Exception as e:
            print(f"Scanner error: {e}")

        await browser.close()

    return jobs


async def scan_all(keywords_list: List[str] = None, limit_per_query: int = 10) -> List[Dict]:
    """Run multiple keyword searches and deduplicate results."""
    if keywords_list is None:
        keywords_list = DEFAULT_KEYWORDS

    all_jobs = []
    seen_urls = set()

    for keywords in keywords_list:
        jobs = await scan_linkedin(keywords, limit=limit_per_query)
        for job in jobs:
            if job["url"] not in seen_urls:
                seen_urls.add(job["url"])
                all_jobs.append(job)
        await asyncio.sleep(2)  # Be polite to LinkedIn

    return all_jobs
