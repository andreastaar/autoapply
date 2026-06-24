/**
 * Generic CV generator: parses career-ops/cv.md into a canonical .docx
 * (Calibri, all black, US Letter, no summary).
 *
 * Usage: node gen_cv.mjs --out <docx> [--gaps <gaps.json>]
 *   --gaps : optional JSON {"missing":["kw1","kw2",...]} → appends a
 *            "Target Skills" line with fixable missing keywords (ATS boost).
 */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, TabStopType
} = require('/usr/local/lib/node_modules/docx/dist/index.cjs');

const args = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const OUT = getArg('--out') || '/tmp/cv-out.docx';
const GAPS = getArg('--gaps');
// --md lets the caller pass a tailored markdown CV file (AI-rewritten); falls back to cv.md
const CV_MD = getArg('--md') || '/Users/andrea_star/Desktop/Applications/career-ops/cv.md';

const PAGE_W = 12240, PAGE_H = 15840;
const M = { top: 288, bottom: 288, left: 432, right: 432 };
const CONTENT_W = PAGE_W - M.left - M.right;
const TAB_RIGHT = [{ type: TabStopType.RIGHT, position: CONTENT_W }];
const sp = (b = 0, a = 0, line = 240) => ({ before: b, after: a, line });
const run = (t, o = {}) => new TextRun({ text: t, font: 'Calibri', color: '000000',
  size: o.size ?? 18, bold: o.bold ?? false, italics: o.italics ?? false, allCaps: o.allCaps ?? false });
const para = (ch, o = {}) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: o.spacing ?? sp(),
  border: o.border, tabStops: o.tabStops, numbering: o.numbering, children: Array.isArray(ch) ? ch : [ch] });
const sectionTitle = (t) => para(run(t, { size: 22, bold: true, allCaps: true }),
  { spacing: sp(60, 20), border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } } });
const bullet = (ch) => para(ch, { spacing: sp(0, 0), numbering: { reference: 'bullets', level: 0 } });

// strip markdown emphasis/entities
const clean = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  .replace(/∙/g, '·').trim();

// parse a "**bold** ...... right" line into [left,right]
function splitRight(line) {
  const m = clean(line).match(/^(.*?)\s{2,}([A-Za-z0-9].*)$/);
  return m ? [m[1].trim(), m[2].trim()] : [clean(line), ''];
}
// render **bold** inline within a string → TextRun[]
function inlineRuns(s, size = 18) {
  const parts = [];
  const re = /\*\*(.+?)\*\*/g; let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(run(s.slice(last, m.index), { size }));
    parts.push(run(m[1], { size, bold: true }));
    last = re.lastIndex;
  }
  if (last < s.length) parts.push(run(s.slice(last), { size }));
  return parts.length ? parts : [run(s, { size })];
}

const md = fs.readFileSync(CV_MD, 'utf8');
const lines = md.split('\n');
const children = [];

// Header: first non-empty = name, next = contact
let idx = 0;
while (idx < lines.length && !lines[idx].trim()) idx++;
const name = clean(lines[idx].replace(/^#\s*/, '')).toUpperCase(); idx++;
while (idx < lines.length && !lines[idx].trim()) idx++;
const contact = clean(lines[idx]); idx++;
children.push(para(run(name, { size: 36, bold: true }), { spacing: sp(0, 2) }));
children.push(para(run(contact, { size: 18 }), { spacing: sp(0, 6) }));

for (; idx < lines.length; idx++) {
  let line = lines[idx];
  const t = line.trim();
  if (!t || t === '---') continue;

  if (t.startsWith('## ')) { children.push(sectionTitle(clean(t.slice(3)))); continue; }

  // bullet
  if (t.startsWith('●') || t.startsWith('•') || t.startsWith('- ')) {
    const body = t.replace(/^[●•\-]\s*/, '');
    children.push(bullet(inlineRuns(body)));
    continue;
  }

  // skill row: **Label:** rest
  const skill = t.match(/^\*\*(.+?:)\*\*\s*(.*)$/);
  if (skill) {
    children.push(para([run(skill[1] + ' ', { size: 18, bold: true }), ...inlineRuns(skill[2])], { spacing: sp(0, 0) }));
    continue;
  }

  // project line: **Name** | tech ...... github
  if (t.startsWith('**') && t.includes('|')) {
    const [left, right] = splitRight(t);
    const pm = left.match(/^\*\*(.+?)\*\*\s*\|\s*(.*)$/);
    if (pm) {
      children.push(para([run(pm[1], { size: 18, bold: true }), run(' | ', { size: 18 }),
        run(pm[2], { size: 18, italics: true }), run('\t', { size: 18 }), run(clean(right), { size: 18 })],
        { spacing: sp(40, 0), tabStops: TAB_RIGHT }));
      continue;
    }
  }

  // company/school line: **Bold**  ......  Right
  if (t.startsWith('**')) {
    const [left, right] = splitRight(t);
    const bm = left.match(/^\*\*(.+?)\*\*(.*)$/);
    const boldText = bm ? bm[1] : clean(left);
    children.push(para([run(boldText, { size: 22, bold: true }), run('\t', { size: 22 }), run(clean(right), { size: 18 })],
      { spacing: sp(60, 0), tabStops: TAB_RIGHT }));
    continue;
  }

  // italic detail
  if (t.startsWith('*') && t.endsWith('*')) {
    children.push(para(run(clean(t.replace(/^\*|\*$/g, '')), { size: 18, italics: true }), { spacing: sp(0, 0) }));
    continue;
  }

  // degree / plain line (may have right-aligned date)
  const [left, right] = splitRight(t);
  if (right) {
    children.push(para([...inlineRuns(left, 20), run('\t', { size: 20 }), run(clean(right), { size: 18 })],
      { spacing: sp(0, 0), tabStops: TAB_RIGHT }));
  } else {
    children.push(para(inlineRuns(clean(t)), { spacing: sp(0, 0) }));
  }
}

// Append target keywords (ATS boost) + "Why <company>" interest line if gaps provided
if (GAPS && fs.existsSync(GAPS)) {
  try {
    const gaps = JSON.parse(fs.readFileSync(GAPS, 'utf8'));
    const skip = new Set(['remote','required','around','even','benefits','united','states',
      'range','including','interviews','equal','one','great','plus','nice','many','doing',
      'them','throughout','deeply','embedded','culture','hundreds','disciplines','site','bring',
      'rely','helps','enables','leverage','collect','optimize','future','central']);
    // product/brand/location words live in the "Why" line, NOT in Target Skills
    const whySet = new Set((gaps.why_keywords || []).map(k => k.toLowerCase()));
    const kws = (gaps.missing || []).filter(k => {
      const l = k.toLowerCase();
      return !skip.has(l) && !whySet.has(l) && k.length > 3;
    }).slice(0, 60);
    if (kws.length) {
      children.push(para([run('Target Skills: ', { size: 18, bold: true }), run(kws.join(' · '), { size: 18 })],
        { spacing: sp(0, 0) }));
    }
    // "Why <company>" line — legitimately carries product/brand/location keywords as genuine interest
    if (gaps.company && (gaps.why_keywords || []).length) {
      const why = gaps.why_keywords.slice(0, 20).join(', ');
      children.push(para([
        run(`Why ${gaps.company}: `, { size: 18, bold: true }),
        run(`Genuinely excited about ${gaps.company}'s mission and work across ${why} — and motivated to contribute and grow on the team.`, { size: 18 }),
      ], { spacing: sp(0, 0) }));
    }
  } catch {}
}

const doc = new Document({
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 360 }, spacing: sp(0, 0) },
    run: { font: 'Calibri', size: 18, color: '000000' } } }] }] },
  sections: [{ properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: M } }, children }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('Written:', OUT); });
