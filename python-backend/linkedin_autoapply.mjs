/**
 * LinkedIn Easy Apply — Full Auto Bot
 * Uses your real Chrome session (no login needed)
 *
 * Usage: node linkedin_autoapply.mjs [--keywords "data engineer"] [--max 10] [--dry-run]
 *
 * --dry-run  : find jobs but don't submit (just log what would be applied)
 * --max N    : max applications per run (default: 10)
 * --keywords : search keywords (default: "data analytics engineer intern")
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/usr/local/lib/node_modules/playwright');
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ── Config ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (f, def) => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : def; };
const DRY_RUN = args.includes('--dry-run');
const MAX_APPS = parseInt(getArg('--max', '10'));
const KEYWORDS = getArg('--keywords', 'data analytics engineer intern scientist');
const DELAY_MS = 180000; // 3 min between applications (avoids ban)

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1508406384830709822/Z8kN6TjvvVqr5J3KxbOWqC4xSENQyHhFLri8lz8gJGhHwjUcSmMEymr6wId_1QIn2-Wf";

// Andrea's answers for common screening questions
const ANSWERS = {
  authorized: 'Yes',           // authorized to work in US?
  sponsorship: 'No',           // need sponsorship? → change to Yes if needed
  experience_years: '3',       // years of experience
  salary: '80000',             // expected salary
  notice: '2 weeks',           // notice period
  remote: 'Yes',               // open to remote?
  relocate: 'Yes',             // willing to relocate?
  degree: "Master's",          // highest degree
};

// CV file to upload
const CV_PDF = '/Users/andrea_star/Desktop/Applications/career-ops/output/cv-andrea-tesla-2026-05-30.pdf';

// ── Discord notify ───────────────────────────────────────────────────────────
async function notify(msg) {
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
    if (!fetch) return;
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg })
    });
  } catch {}
}

// ── Sleep ────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Fill a single text/select field ─────────────────────────────────────────
async function fillField(page, el) {
  const tag = await el.evaluate(e => e.tagName.toLowerCase());
  const label = await el.evaluate(e => {
    const l = document.querySelector(`label[for="${e.id}"]`);
    return (l?.innerText || e.placeholder || e.name || e.getAttribute('aria-label') || '').toLowerCase();
  }).catch(() => '');

  if (tag === 'select') {
    // Try to pick "Yes" or the most appropriate option
    const opts = await el.evaluate(e => [...e.options].map(o => o.text.toLowerCase()));
    if (opts.some(o => o.includes('yes'))) {
      await el.selectOption({ label: [...(await el.evaluate(e => [...e.options].map(o => o.text)))].find(o => /yes/i.test(o)) || '' }).catch(() => {});
    } else if (opts.length > 1) {
      await el.selectOption({ index: 1 }).catch(() => {});
    }
    return;
  }

  if (tag === 'input') {
    const type = await el.getAttribute('type') || 'text';
    if (['hidden', 'file', 'checkbox', 'radio', 'submit', 'button'].includes(type)) return;

    // Map label to answer
    let val = '';
    if (/year|experience|how long/i.test(label)) val = ANSWERS.experience_years;
    else if (/salary|compensation|expected pay/i.test(label)) val = ANSWERS.salary;
    else if (/notice|start date/i.test(label)) val = ANSWERS.notice;
    else if (/sponsor/i.test(label)) val = ANSWERS.sponsorship;
    else if (/authoriz|eligible|legally/i.test(label)) val = ANSWERS.authorized;
    else if (/relocat/i.test(label)) val = ANSWERS.relocate;
    else if (/remote|work from home/i.test(label)) val = ANSWERS.remote;

    if (val) {
      await el.fill(val).catch(() => {});
    }
    return;
  }

  if (tag === 'textarea') {
    const current = await el.inputValue().catch(() => '');
    if (!current) {
      await el.fill('I am very excited about this opportunity and believe my background in data analytics and ML engineering makes me a strong fit.').catch(() => {});
    }
  }
}

// ── Handle radio/checkbox questions ─────────────────────────────────────────
async function handleRadio(page) {
  const fieldsets = await page.locator('fieldset').all().catch(() => []);
  for (const fs of fieldsets) {
    const legend = await fs.locator('legend').textContent().catch(() => '').then(t => t.toLowerCase());
    const radios = await fs.locator('input[type="radio"]').all().catch(() => []);
    if (!radios.length) continue;

    // Default: click "Yes" or first option
    let clicked = false;
    for (const r of radios) {
      const rLabel = await page.evaluate(el => {
        const l = el.closest('label') || document.querySelector(`label[for="${el.id}"]`);
        return (l?.innerText || '').toLowerCase();
      }, await r.elementHandle()).catch(() => '');

      if (/yes|authorized|eligible/i.test(rLabel) && !clicked) {
        await r.check().catch(() => {});
        clicked = true;
      }
    }
    if (!clicked && radios[0]) {
      await radios[0].check().catch(() => {});
    }
  }
}

// ── Upload CV ────────────────────────────────────────────────────────────────
async function uploadCV(page) {
  if (!existsSync(CV_PDF)) return false;
  const fileInputs = await page.locator('input[type="file"]').all().catch(() => []);
  for (const fi of fileInputs) {
    try {
      await fi.setInputFiles(CV_PDF);
      console.log('  📎 CV uploaded');
      return true;
    } catch {}
  }
  return false;
}

// ── Complete one Easy Apply flow ─────────────────────────────────────────────
async function applyToJob(page, jobTitle, jobCompany, jobId) {
  console.log(`\n🚀 Applying: ${jobCompany} — ${jobTitle}`);

  // Find Apply button — filter by text content (handles whitespace/newlines)
  const allBtnsNow = await page.locator('button').all();
  let easyApplyBtn = null;
  for (const btn of allBtnsNow) {
    const txt = await btn.textContent().catch(() => '');
    const aria = await btn.getAttribute('aria-label').catch(() => '');
    if (/apply/i.test(txt) || /apply/i.test(aria)) {
      easyApplyBtn = btn; break;
    }
  }
  if (!easyApplyBtn) {
    console.log('  ❌ No Apply button found');
    return false;
  }
  // Force click via JS (bypasses visibility check for off-screen elements)
  await easyApplyBtn.evaluate(btn => btn.click()).catch(async () => {
    await easyApplyBtn.click({ force: true }).catch(() => {});
  });
  await sleep(1500);

  let step = 0;
  const MAX_STEPS = 8;

  while (step < MAX_STEPS) {
    step++;
    await sleep(800);

    // Upload CV if file input visible
    await uploadCV(page);

    // Fill all text/select fields
    const inputs = await page.locator('input:not([type="hidden"]):not([type="file"]):not([type="submit"]), textarea, select').all().catch(() => []);
    for (const el of inputs) {
      await fillField(page, el);
    }

    // Handle radio/checkbox questions
    await handleRadio(page);

    await sleep(500);

    // Check for "Review" or "Submit" button
    const submitBtn = page.locator('button[aria-label*="Submit"], button:has-text("Submit application")').first();
    const reviewBtn = page.locator('button[aria-label*="Review"], button:has-text("Review")').first();
    const nextBtn = page.locator('button[aria-label*="Continue"], button:has-text("Next")').first();

    if (await submitBtn.isVisible().catch(() => false)) {
      if (DRY_RUN) {
        console.log(`  🔵 DRY RUN — would submit to ${jobCompany}`);
        await page.locator('button[aria-label*="Dismiss"], button:has-text("Discard")').first().click().catch(() => {});
        await page.locator('button:has-text("Discard")').first().click().catch(() => {});
        return 'dry_run';
      }
      await submitBtn.click();
      await sleep(2000);
      console.log(`  ✅ SUBMITTED: ${jobCompany} — ${jobTitle}`);
      // Close confirmation
      await page.locator('button[aria-label*="Dismiss"]').first().click().catch(() => {});
      return true;
    }

    if (await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click();
      continue;
    }

    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      continue;
    }

    // No button found — might be done or stuck
    break;
  }

  // Close if still open
  await page.locator('button[aria-label*="Dismiss"]').first().click().catch(() => {});
  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n⚡ LinkedIn Easy Apply Bot`);
  console.log(`   Keywords: ${KEYWORDS}`);
  console.log(`   Max: ${MAX_APPS} | Dry run: ${DRY_RUN}`);
  console.log(`   Delay: ${DELAY_MS/60000} min between apps\n`);

  // Load cookies
  const COOKIES_FILE = new URL('./linkedin_cookies.json', import.meta.url).pathname;
  const { readFileSync } = await import('fs');
  const rawCookies = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));

  const browser = await chromium.launch({
    headless: false, slowMo: 300,
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
  });

  // Inject cookies with EXACT domains (no modification)
  const cookies = rawCookies.map(c => ({
    name: c.name, value: c.value, path: c.path || '/',
    domain: c.domain,  // keep exact — www.linkedin.com stays www.linkedin.com
    secure: c.secure || false,
    httpOnly: c.httpOnly || false,
    sameSite: c.sameSite === 'no_restriction' ? 'None' : c.sameSite === 'lax' ? 'Lax' : 'None',
    expires: c.expirationDate ? Math.floor(c.expirationDate) : -1,
  }));
  await context.addCookies(cookies);
  console.log(`✅ Injected ${cookies.length} cookies`);

  const page = await context.newPage();
  const timeFilter = getArg('--days', '1') === '7' ? 'r604800' : 'r86400';
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(KEYWORDS)}&f_AL=true&f_TPR=${timeFilter}&sortBy=DD`;

  // Navigate directly to jobs (no redirect needed with correct cookies)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  const curUrl = page.url();
  const loggedIn = !curUrl.includes('/login') && !curUrl.includes('/checkpoint');
  if (!loggedIn) {
    console.log('❌ Not logged in — cookies may have expired. Export fresh cookies and retry.');
    await browser.close(); return;
  }
  console.log('✅ Logged in to LinkedIn\n');

  // Wait for job links to load
  await page.waitForSelector('a[href*="/jobs/view/"]', { timeout: 15000 }).catch(() => {});
  await sleep(2000);

  // Collect job listings using correct LinkedIn selectors
  const jobs = [];
  const seen = new Set();
  let scrolls = 0;

  while (jobs.length < MAX_APPS * 3 && scrolls < 6) {
    const links = await page.locator('a[href*="/jobs/view/"]').all().catch(() => []);
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => '');
      // LinkedIn URL format: /jobs/view/job-title-JOBID or /jobs/view/JOBID
      const m = href?.match(/\/jobs\/view\/(?:[^?]*?-)?(\d{7,})/);
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      const jobId = m[1];
      const title = await link.textContent().catch(() => '');
      // Get company from sibling/parent elements
      const company = await link.evaluate(el => {
        const card = el.closest('[class*="job-card"], li, .base-card');
        if (!card) return '';
        const co = card.querySelector('[class*="company"], [class*="subtitle"], .job-card-container__company-name, h4');
        return co?.innerText || '';
      }).catch(() => '');
      if (title?.trim()) {
        // Use LinkedIn's internal URL (shows Easy Apply modal when logged in)
      jobs.push({ id: jobId, title: title.trim(), company: company.trim(), url: `https://www.linkedin.com/jobs/search/?currentJobId=${jobId}&f_AL=true` });
      }
    }
    await page.evaluate(() => window.scrollBy(0, 1000));
    await sleep(1500);
    scrolls++;
  }

  console.log(`📋 Found ${jobs.length} Easy Apply jobs (last 24h)\n`);

  if (!jobs.length) {
    console.log('No jobs found. Try different keywords or check your LinkedIn login.');
    return;
  }

  // Apply to each job
  let applied = 0;
  const results = [];

  // Stay on search page — click job cards in the left panel (Easy Apply modal works here)
  for (const job of jobs.slice(0, MAX_APPS)) {
    if (applied >= MAX_APPS) break;

    // Click on the job card in the list to show it in right panel
    const jobCard = page.locator(`a[href*="${job.id}"]`).first();
    if (await jobCard.count() === 0) {
      // Scroll down to find card
      await page.evaluate(() => window.scrollBy(0, 600));
      await sleep(1000);
    }
    await jobCard.click({ force: true }).catch(async () => {
      // Fallback: navigate and come back
      await page.goto(url + `&currentJobId=${job.id}`, { timeout: 20000 }).catch(() => {});
    });
    await sleep(2500);

    const result = await applyToJob(page, job.title, job.company, job.id);
    if (result) {
      applied++;
      results.push({ ...job, result });
      console.log(`  ⏳ Waiting ${DELAY_MS/60000} min before next application...`);
      if (applied < MAX_APPS) await sleep(DELAY_MS);
    }
  }

  // Summary
  console.log(`\n📊 Summary: ${applied} applications sent`);
  for (const r of results) {
    console.log(`  ✅ ${r.company} — ${r.title}`);
  }

  // Discord notification
  if (applied > 0) {
    const mode = DRY_RUN ? '(DRY RUN)' : '';
    const msg = `⚡ **LinkedIn Auto-Apply ${mode}**\n✅ Applied to **${applied} jobs** today:\n` +
      results.map(r => `• ${r.company} — ${r.title}`).join('\n');
    await notify(msg);
  }

  await sleep(3000);
  await browser.close().catch(() => {});
}

main().catch(e => { console.error(e.message); process.exit(1); });
