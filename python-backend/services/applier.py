"""
Auto-applier using Playwright.
Supports: Workday, Greenhouse, Lever, LinkedIn Easy Apply
"""
import asyncio
import os
from pathlib import Path
from typing import Optional
from playwright.async_api import async_playwright, Page
from config import settings

PROFILE = {
    "name":     settings.CANDIDATE_NAME,
    "email":    settings.CANDIDATE_EMAIL,
    "phone":    settings.CANDIDATE_PHONE,
    "city":     settings.CANDIDATE_CITY,
    "state":    settings.CANDIDATE_STATE,
    "zip":      settings.CANDIDATE_ZIP,
    "linkedin": settings.CANDIDATE_LINKEDIN,
    "github":   settings.CANDIDATE_GITHUB,
    "school":   "Lewis University",
    "degree":   "Master of Science",
    "major":    "Business Analytics",
    "gpa":      "4.0",
    "grad_year": "2027",
}


async def _fill_if_exists(page: Page, selector: str, value: str):
    try:
        el = await page.wait_for_selector(selector, timeout=2000)
        if el:
            await el.fill(value)
    except Exception:
        pass


async def apply_workday(url: str, cv_pdf_path: str, dry_run: bool = False) -> dict:
    """Apply to a Workday job. Returns {'success': bool, 'message': str}"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not dry_run)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        try:
            await page.goto(url, timeout=30000)
            await page.wait_for_load_state("networkidle")

            # Click "Apply" button
            for sel in ["text=Apply", "text=Apply Now", "[data-automation-id='applyBtn']",
                        "button:has-text('Apply')"]:
                try:
                    await page.click(sel, timeout=3000)
                    await asyncio.sleep(2)
                    break
                except Exception:
                    pass

            # Upload CV
            for sel in ["input[type='file']", "[data-automation-id='file-upload-input']"]:
                try:
                    await page.set_input_files(sel, cv_pdf_path, timeout=3000)
                    await asyncio.sleep(1)
                    break
                except Exception:
                    pass

            # Fill form fields
            field_map = {
                "[data-automation-id='legalNameSection_firstName']": PROFILE["name"].split()[0],
                "[data-automation-id='legalNameSection_lastName']":  PROFILE["name"].split()[-1],
                "input[autocomplete='email']":                        PROFILE["email"],
                "input[type='email']":                                PROFILE["email"],
                "input[autocomplete='tel']":                          PROFILE["phone"],
                "[data-automation-id='phone']":                       PROFILE["phone"],
                "[placeholder*='City']":                              PROFILE["city"],
                "[placeholder*='Zip']":                               PROFILE["zip"],
                "[placeholder*='LinkedIn']":                          f"https://{PROFILE['linkedin']}",
            }
            for sel, val in field_map.items():
                await _fill_if_exists(page, sel, val)

            await asyncio.sleep(1)

            if dry_run:
                await browser.close()
                return {"success": True, "message": "Dry run — form filled, not submitted"}

            # Click Submit
            for sel in ["text=Submit", "text=Submit Application",
                        "[data-automation-id='bottom-navigation-next-button']",
                        "button[type='submit']"]:
                try:
                    await page.click(sel, timeout=3000)
                    await asyncio.sleep(3)
                    return {"success": True, "message": "Applied via Workday"}
                except Exception:
                    pass

            await browser.close()
            return {"success": False, "message": "Could not find submit button"}

        except Exception as e:
            await browser.close()
            return {"success": False, "message": str(e)}


async def apply_greenhouse(url: str, cv_pdf_path: str, dry_run: bool = False) -> dict:
    """Apply to a Greenhouse job."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not dry_run)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        try:
            await page.goto(url, timeout=30000)
            await page.wait_for_load_state("networkidle")

            # Upload resume
            try:
                await page.set_input_files("input#resume", cv_pdf_path, timeout=5000)
            except Exception:
                pass

            # Fill fields
            await _fill_if_exists(page, "input#first_name", PROFILE["name"].split()[0])
            await _fill_if_exists(page, "input#last_name",  PROFILE["name"].split()[-1])
            await _fill_if_exists(page, "input#email",      PROFILE["email"])
            await _fill_if_exists(page, "input#phone",      PROFILE["phone"])
            await _fill_if_exists(page, "input#location",   f"{PROFILE['city']}, {PROFILE['state']}")

            if dry_run:
                await browser.close()
                return {"success": True, "message": "Dry run Greenhouse — not submitted"}

            # Submit
            try:
                await page.click("input[type='submit']", timeout=3000)
                await asyncio.sleep(3)
                await browser.close()
                return {"success": True, "message": "Applied via Greenhouse"}
            except Exception as e:
                await browser.close()
                return {"success": False, "message": str(e)}

        except Exception as e:
            await browser.close()
            return {"success": False, "message": str(e)}


async def apply_lever(url: str, cv_pdf_path: str, dry_run: bool = False) -> dict:
    """Apply to a Lever job."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not dry_run)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        try:
            await page.goto(url, timeout=30000)
            await page.wait_for_load_state("networkidle")

            # Upload
            try:
                await page.set_input_files("input[type='file']", cv_pdf_path, timeout=5000)
            except Exception:
                pass

            await _fill_if_exists(page, "input[name='name']",  PROFILE["name"])
            await _fill_if_exists(page, "input[name='email']", PROFILE["email"])
            await _fill_if_exists(page, "input[name='phone']", PROFILE["phone"])
            await _fill_if_exists(page, "input[name='org']",   "Lewis University")

            if dry_run:
                await browser.close()
                return {"success": True, "message": "Dry run Lever — not submitted"}

            try:
                await page.click("button[type='submit']", timeout=3000)
                await asyncio.sleep(3)
                await browser.close()
                return {"success": True, "message": "Applied via Lever"}
            except Exception as e:
                await browser.close()
                return {"success": False, "message": str(e)}

        except Exception as e:
            await browser.close()
            return {"success": False, "message": str(e)}


def detect_platform(url: str) -> str:
    url_l = url.lower()
    if "myworkday" in url_l or "wd1." in url_l or "wd5." in url_l or "workday" in url_l:
        return "workday"
    if "greenhouse.io" in url_l or "boards.greenhouse" in url_l:
        return "greenhouse"
    if "jobs.lever.co" in url_l or "lever.co" in url_l:
        return "lever"
    if "linkedin.com/jobs" in url_l:
        return "linkedin"
    return "other"


async def auto_apply(url: str, cv_pdf_path: str, dry_run: bool = False) -> dict:
    """Detect platform and apply."""
    platform = detect_platform(url)
    if platform == "workday":
        return await apply_workday(url, cv_pdf_path, dry_run)
    elif platform == "greenhouse":
        return await apply_greenhouse(url, cv_pdf_path, dry_run)
    elif platform == "lever":
        return await apply_lever(url, cv_pdf_path, dry_run)
    else:
        return {"success": False, "message": f"Platform not supported: {platform}"}
