/**
 * Assisted application form-filler (Playwright).
 *
 * Opens a job posting, attempts to fill common fields (name, email, phone,
 * location, LinkedIn, school) and upload the CV, then PAUSES — it NEVER clicks
 * Submit. The user reviews and submits manually.
 *
 * Usage: node apply_filler.mjs --url <postingURL> --cv <pdfOrDocxPath>
 *
 * Requires: npm i -g playwright && npx playwright install chromium
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const URL = get('--url');
const CV = get('--cv');

const PROFILE = {
  firstName: 'Andrea', lastName: 'Estrella',
  fullName: 'Andrea Estrella',
  email: 'aestrellaoliva@gmail.com',
  phone: '(779) 390-4034',
  city: 'Chicago', state: 'IL', zip: '60601', country: 'United States',
  linkedin: 'https://linkedin.com/in/andreaa-estrellaa',
  github: 'https://github.com/andreastaar',
  school: 'Lewis University', degree: 'M.S. Business Analytics',
};

// label/placeholder/name substrings -> profile value (order matters: specific first)
const FIELD_MAP = [
  [['first name', 'given name'], PROFILE.firstName],
  [['last name', 'family name', 'surname'], PROFILE.lastName],
  [['full name', 'legal name', 'your name'], PROFILE.fullName],
  [['email'], PROFILE.email],
  [['phone', 'mobile', 'tel'], PROFILE.phone],
  [['linkedin'], PROFILE.linkedin],
  [['github', 'portfolio', 'personal website'], PROFILE.github],
  [['where did you go', 'college', 'school', 'university', 'institution'], PROFILE.school],
  [['degree'], PROFILE.degree],
  [['how did you hear'], 'LinkedIn'],
  [['city'], PROFILE.city],
  [['state', 'province'], PROFILE.state],
  [['zip', 'postal'], PROFILE.zip],
  [['country'], PROFILE.country],
  [['name'], PROFILE.fullName],   // generic "Name" → full name (Ashby _systemfield_name), kept last
];

async function main() {
  if (!URL) { console.error('Missing --url'); process.exit(1); }
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch {
    try { ({ chromium } = require('/usr/local/lib/node_modules/playwright')); }
    catch { console.error('Playwright not installed. Run: npm i -g playwright && npx playwright install chromium'); process.exit(1); }
  }

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(3000);

  // Click "Apply" to reveal/navigate to the application form (button OR link)
  for (const t of ['Apply for this job', 'Apply Now', 'Apply', 'interested']) {
    const b = page.getByRole('button', { name: new RegExp(t, 'i') }).first();
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await page.waitForTimeout(2500); break; }
    const l = page.getByRole('link', { name: new RegExp(t, 'i') }).first();
    if (await l.count().catch(() => 0)) { await l.click().catch(() => {}); await page.waitForTimeout(2500); break; }
  }
  await page.waitForTimeout(1500);

  // Build [element, contextString] using the associated <label> text first (Ashby/Greenhouse)
  let filled = 0;
  const handles = await page.locator('input, textarea').elementHandles().catch(() => []);
  for (const el of handles) {
    const meta = await el.evaluate(e => ({
      type: e.type || e.tagName.toLowerCase(),
      label: (e.labels && e.labels[0] ? e.labels[0].innerText : '') || e.getAttribute('aria-label') || '',
      name: e.getAttribute('name') || '', ph: e.getAttribute('placeholder') || '', id: e.id || '',
    })).catch(() => null);
    if (!meta) continue;
    if (['hidden', 'file', 'checkbox', 'radio', 'submit', 'button'].includes(meta.type)) continue;
    const ctxStr = `${meta.label} ${meta.name} ${meta.ph} ${meta.id}`.toLowerCase();
    for (const [keys, val] of FIELD_MAP) {
      if (keys.some(k => ctxStr.includes(k))) {
        await el.fill(val).catch(() => {});
        filled++; break;
      }
    }
  }

  // Upload CV to the resume/file input (prefer one labelled resume/cv)
  if (CV) {
    let target = page.locator('input#_systemfield_resume, input[name*="resume" i], input[type="file"]').first();
    if (await target.count().catch(() => 0)) {
      await target.setInputFiles(CV).catch(() => {});
      console.log('Uploaded CV:', CV);
    }
  }

  console.log(`\n✅ Form-filler done — filled ~${filled} fields.`);
  console.log('⏸️  PAUSED before Submit. Review the form, fix anything, and click Submit yourself.');
  console.log('   (This script never submits. Close the browser window when done.)');
  // Keep the browser open for the user; do not close.
}

main().catch(e => { console.error(e.message); process.exit(1); });
