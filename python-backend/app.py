"""
career-autopilot — full local pipeline server
Steps: Analyze (accurate ATS via career-ops) -> Save to queue -> Generate tailored CV -> Download.
Run:  python3 app.py   (port 8800)
"""
import os, json, sqlite3, re, subprocess, tempfile, urllib.parse
from pathlib import Path
from datetime import datetime, date
from http.server import HTTPServer, BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE = Path(__file__).parent
DB = BASE / "autopilot.db"
CAREER_OPS = Path("/Users/andrea_star/Desktop/Applications/career-ops")
OUTPUT = CAREER_OPS / "output"
GEN_CV = BASE / "gen_cv.mjs"

# ── DB ──────────────────────────────────────────────────────────────────────
def db():
    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row; return con

def init_db():
    con = db()
    con.execute("""CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, company TEXT, location TEXT, url TEXT, platform TEXT,
        jd_text TEXT, ats_score REAL, cv_file TEXT, status TEXT DEFAULT 'discovered',
        created_at TEXT)""")
    # migrate older DBs: add any missing columns
    cols = {r[1] for r in con.execute("PRAGMA table_info(jobs)").fetchall()}
    for col, decl in [("jd_text", "TEXT"), ("cv_file", "TEXT"), ("ats_score", "REAL"),
                      ("semantic_score", "REAL"), ("recommendation", "TEXT"), ("posted_at", "TEXT")]:
        if col not in cols:
            con.execute(f"ALTER TABLE jobs ADD COLUMN {col} {decl}")
    con.commit(); con.close()

DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1508406384830709822/Z8kN6TjvvVqr5J3KxbOWqC4xSENQyHhFLri8lz8gJGhHwjUcSmMEymr6wId_1QIn2-Wf"

def notify_discord(message: str, title: str = "⚡ Career Autopilot", color: int = 6366961):
    """Send a notification to Andrea's Discord. Best-effort, never blocks the request."""
    import urllib.request
    payload = json.dumps({"embeds": [{"title": title, "description": message, "color": color,
                                      "footer": {"text": "career-autopilot"}}]}).encode()
    try:
        req = urllib.request.Request(DISCORD_WEBHOOK, data=payload,
                                     headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=8)
    except Exception:
        pass

def read_cv():
    cv = CAREER_OPS / "cv.md"
    return cv.read_text() if cv.exists() else ""

# ── Fit grading for the curated digest ───────────────────────────────────────
# Exclude roles clearly NOT Andrea's fit
EXCLUDE_TITLE = [
    "account executive", "business development", "bdr", "sdr", "sales rep",
    "presales", "solutions engineer", "solutions consultant", "maintenance",
    "technician", "recruiter", "sourcer", "talent acquisition",
    "customer success", "success manager", "outcomes manager",
    "field architect", "account manager", "marketing manager",
    "graphic designer", "ux designer", "ui designer", "visual designer",
    "support engineer", "warehouse", "driver", "front desk",
    "legal counsel", "attorney", "paralegal", "hr generalist",
    "office manager", "executive assistant",
]
# Andrea has 5+ yrs experience — don't exclude senior roles
# Only exclude C-suite / VP and above
EXCLUDE_SENIOR = ["vice president", " vp ", "chief ", "cto", "cio", "cfo",
                  "executive director", "managing director"]
# Grade A = strong data/ML/analytics fit (all seniority levels — Andrea has 5+ yrs)
A_TITLE = [
    "data scientist", "data engineer", "data analyst", "analytics engineer",
    "senior data", "staff data", "lead data", "principal data",
    "machine learning", "ml engineer", "ml intern", "ml researcher",
    "senior ml", "staff ml", "data science intern", "data engineering intern",
    "analytics intern", "ai engineer", "ai researcher", "ai/ml",
    "applied scientist", "senior applied", "research engineer", "research scientist",
    "deep learning", "nlp engineer", "computer vision",
    "business intelligence", "bi engineer", "bi analyst",
    "quantitative analyst", "quant ", "product analyst",
    "growth analyst", "revenue analyst", "data infrastructure",
    "data platform", "analytics platform", "data product",
    "analytics manager", "data manager", "analytics lead",
]
# Grade B = adjacent good fits
B_TITLE = [
    "data", "analyst", "analytics", "ml", "ai ", " ai",
    "intern", "engineer", "scientist", "product manager",
    "software engineer", "backend engineer", "fullstack",
    "platform engineer", "infrastructure",
]
# Wishlist companies always show as Grade A (regardless of title)
WISHLIST_COMPANY_NAMES = {
    "tesla", "anthropic", "openai", "figma", "stripe", "datadog",
    "mongodb", "cloudflare", "brex", "duolingo", "robinhood",
    "perplexity", "cursor", "langchain", "llamaindex", "runway",
    "palantir", "spotify", "decagon", "sierra", "beacon software",
    "elevenlabs", "cohere", "glean", "arize ai", "deepgram", "vapi",
}

def grade_fit(title: str, company: str = ""):
    t = (title or "").lower()
    c = (company or "").lower()
    # Exclude obvious non-fits
    if any(x in t for x in EXCLUDE_TITLE):
        return None
    # Exclude too senior
    if any(x in t for x in EXCLUDE_SENIOR):
        return None
    # Wishlist companies → always A
    if any(wc in c for wc in WISHLIST_COMPANY_NAMES):
        return "A"
    if any(x in t for x in A_TITLE):
        return "A"
    if any(x in t for x in B_TITLE):
        return "B"
    return None

def daily_digest(keywords="data analytics machine learning intern engineer scientist", notify=True):
    """Scan, filter to good fits, grade A/B, format a curated digest, post to Discord."""
    try:
        import scanner
        jobs = scanner.scan(keywords=keywords, limit=120)
    except Exception as e:
        return {"error": str(e)}
    graded = []
    for j in jobs:
        g = grade_fit(j["title"], j.get("company", ""))
        if g:
            graded.append({**j, "grade": g})
    graded.sort(key=lambda x: (x["grade"], x["company"]))
    # store new ones in queue
    con = db(); added = 0
    for j in graded:
        if not con.execute("SELECT 1 FROM jobs WHERE url=?", (j["url"],)).fetchone():
            con.execute("INSERT INTO jobs (title,company,location,url,platform,jd_text,posted_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (j["title"], j["company"], j["location"], j["url"], j["platform"], j.get("jd",""), j.get("posted",""), "discovered", datetime.now().isoformat()))
            added += 1
    con.commit(); con.close()
    # format digest (top 15)
    a = [j for j in graded if j["grade"] == "A"]
    b = [j for j in graded if j["grade"] == "B"]
    lines = [f"**{len(a)} strong (A) + {len(b)} adjacent (B) fits** — {added} new in your queue\n"]
    for j in (a + b)[:15]:
        emoji = "🟢" if j["grade"] == "A" else "🟡"
        loc = (j["location"] or "")[:40]
        lines.append(f"{emoji} **{j['grade']}** — {j['company']} — {j['title']} · {loc}")
    msg = "\n".join(lines)
    if notify:
        notify_discord(msg, title=f"🎯 Daily Job Digest — curated for Andrea", color=3463016)
    return {"a": len(a), "b": len(b), "added": added, "message": msg}

def skillsyncer(jd: str, cv_text_path: str):
    """Run SkillSyncer (GPT-4o semantic ATS) on a CV text file. Returns score + recommendation."""
    tf = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, dir="/tmp")
    tf.write(jd); tf.close()
    try:
        r = subprocess.run(["python3", "skillsyncer-check.py", tf.name, "--cv", cv_text_path],
                           capture_output=True, text=True, cwd=CAREER_OPS, timeout=90)
        out = r.stdout
    except Exception as e:
        return {"semantic": None, "recommendation": None, "error": str(e)}
    finally:
        try: os.unlink(tf.name)
        except: pass
    sc = re.search(r"MATCH SCORE:\s*(\d+)", out)
    rec = re.search(r"RECOMMENDATION:\s*(.+)", out)
    return {"semantic": int(sc.group(1)) if sc else None,
            "recommendation": rec.group(1).strip() if rec else None}

def docx_text(docx_path: Path) -> str:
    """Extract plain text from a .docx for ATS re-scoring."""
    import zipfile
    try:
        with zipfile.ZipFile(docx_path) as z:
            xml = z.read("word/document.xml").decode("utf-8")
        return " ".join(re.findall(r"<w:t[^>]*>([^<]+)</w:t>", xml))
    except Exception:
        return ""

# ── Job scanner (Greenhouse/Ashby/Lever public APIs) ─────────────────────────
def scan_jobs(keywords="data analytics intern engineer", limit=300):
    try:
        import scanner
        return scanner.scan(keywords=keywords, limit=limit,
                            max_companies=150, include_wishlist=True,
                            include_extra=True, include_yc=True, check_live=False)
    except Exception as e:
        return {"error": str(e)}

# ── JD cleaner: keep role-relevant text, drop company marketing / boilerplate ─
BOILERPLATE = [
    "equal opportunity", "equal employment", "accommodation", "accommodations",
    "privacy", "compensation", "salary", "pay range", "pay transparency", "401",
    "benefits", "pto", "vacation", "insurance", "mission is to", "who are we",
    "who we are", "about us", "about the company", "join us", "join our", "diversity",
    "we celebrate", "reasonable accommodation", "disability", "veteran", "regardless of",
    "protected by", "e-verify", "background check", "applicants will", "we obsess",
    "scale intelligence", "shape the future", "passionate about their craft",
    "our values", "humility", "honesty", "hunger", "horizon", "screen reader",
    "cameras on", "in person onboarding", "candidate privacy", "$",
]
# section headers that START the parts we WANT to keep
KEEP_HEADERS = ["what you", "responsibilit", "requirement", "qualification",
                "we'd love", "we are looking", "we're looking", "about the role",
                "about the team", "key responsibilit", "what we're looking",
                "what we value", "what we offer", "you'll do", "you will do",
                "minimum qualif", "preferred qualif", "basic qualif",
                "what to expect", "the ideal candidate", "you have", "you bring",
                "nice to have", "bonus", "experience with", "proficiency"]

MARKETING_LINE = [
    "mission is to", "we obsess", "scale intelligence", "shape the future",
    "passionate about their craft", "who are we", "who we are", "about us",
    "join us", "join our", "we believe", "diverse range", "best in the world",
    "serve humanity", "we like to work", "move fast", "we’re training", "we're training",
]

def clean_jd(jd: str) -> str:
    """Drop company-marketing / benefits / EEO lines; keep role-relevant lines."""
    if not jd:
        return jd
    lines = jd.split("\n")
    kept = []
    for ln in lines:
        low = ln.lower().strip()
        if not low:
            continue
        is_keep_header = any(h in low for h in KEEP_HEADERS)
        if is_keep_header:
            kept.append(ln); continue
        if any(sig in low for sig in BOILERPLATE):
            continue
        if any(sig in low for sig in MARKETING_LINE):
            continue
        kept.append(ln)
    cleaned = "\n".join(kept).strip()
    return cleaned if len(cleaned) > 150 else jd


# ── Accurate ATS via career-ops ats-check.mjs ────────────────────────────────
def check_ats(jd: str, cv_path: str = None, clean: bool = True):
    """Run the real career-ops ATS checker and parse its output."""
    if clean:
        jd = clean_jd(jd)
    tf = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, dir="/tmp")
    tf.write(jd); tf.close()
    # ats_full.mjs = career-ops ATS logic with full JSON output (complete missing list)
    cmd = ["node", "ats_full.mjs", tf.name, "--cv", cv_path or str(CAREER_OPS / "cv.md")]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=BASE, timeout=30)
        data = json.loads(r.stdout)
    except Exception as e:
        return {"score": 0, "matched_count": 0, "total": 0, "missing": [], "error": str(e)}
    finally:
        try: os.unlink(tf.name)
        except: pass
    return {"score": float(data.get("score", 0)),
            "matched_count": data.get("matched_count", 0),
            "total": data.get("total", 0),
            "missing": data.get("missing", [])}

# ── Networking: contacts + outreach + conversation notes (PGP method) ────────
CANDIDATE = {
    "school": "Lewis University", "degree": "M.S. Business Analytics",
    "field": "data, analytics & machine learning", "name": "Andrea Estrella",
    "school_li": "lewis-university",
}

def _li_slug(company: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (company or "").lower()).strip("-")

def contact_pack(company: str, role: str):
    """Build LinkedIn search URLs + outreach messages + conversation notes for a job."""
    import urllib.parse as up
    field = CANDIDATE["field"]
    role_kw = up.quote(role or "data")
    comp_kw = up.quote(company or "")
    # LinkedIn search URLs (user clicks → finds people; safe, no scraping)
    links = {
        "alumni": f"https://www.linkedin.com/school/{CANDIDATE['school_li']}/people/?keywords={role_kw}",
        "company_people": f"https://www.linkedin.com/search/results/people/?keywords={comp_kw}%20{role_kw}",
        "recruiter": f"https://www.linkedin.com/search/results/people/?keywords={comp_kw}%20recruiter%20OR%20talent",
    }
    # Outreach messages (PGP templates personalized) — note: "exploring", never "looking for a job"
    li_note = (f"Hi [name] — I'm a {CANDIDATE['school']} {CANDIDATE['degree']} student exploring careers in "
               f"{field}. I came across your profile while exploring {company} and would love to find 10-15 "
               f"minutes to ask you some questions about your experience. Thank you in advance!")
    cold_email_subj = f"{CANDIDATE['school']} student exploring {company}"
    cold_email = (f"Hi [name],\n\nI'm a {CANDIDATE['school']} {CANDIDATE['degree']} student exploring careers in "
                  f"{field}. I came across your profile while looking into {company} — I saw you had really "
                  f"interesting experience and wanted to see if you might have 10-15 minutes, at a time convenient "
                  f"to you, when I could ask you some questions about your experience.\n\nM/W after 4pm and "
                  f"Tue/Th before 10am are generally good for me, but I can be flexible to fit your schedule.\n\n"
                  f"Thank you in advance for your time!\n\nBest,\n{CANDIDATE['name']}\n"
                  f"linkedin.com/in/andreaa-estrellaa")
    post_apply = (f"Hi [name] — I'm a {CANDIDATE['school']} {CANDIDATE['degree']} student who recently applied to "
                  f"the {role} role. I just wanted to reach out to say I'm genuinely excited about it and think my "
                  f"background in {field} is a strong fit. Thank you for your consideration!")
    # Email-finder: domain guess + common patterns + lookup tools
    dom = re.sub(r"[^a-z0-9]", "", (company or "").lower())
    domains = [f"{dom}.com", f"{dom}.io", f"{dom}.ai"]
    patterns = ["first.last@" + domains[0], "flast@" + domains[0],
                "first@" + domains[0], "firstl@" + domains[0], "first_last@" + domains[0]]
    email_tools = {
        "hunter": f"https://hunter.io/search/{domains[0]}",
        "apollo": f"https://app.apollo.io/#/people?qOrganizationName={comp_kw}",
        "google_format": f"https://www.google.com/search?q={comp_kw}+email+format",
        "rocketreach": f"https://rocketreach.co/search?company={comp_kw}",
    }
    return {"links": links, "li_note": li_note, "cold_email_subject": cold_email_subj,
            "cold_email": cold_email, "post_apply": post_apply,
            "email_domains": domains, "email_patterns": patterns, "email_tools": email_tools}

def conversation_notes(company: str, role: str, jd: str = ""):
    """Generate a PGP-style conversation note-sheet (Intro → Q1/Q2/Q3 → Closing) via GPT-4o."""
    try:
        import ai_tailor, json as _json, urllib.request
        key = ai_tailor._api_key()
        if not key:
            return None
        sys_p = ("You write concise informational-interview prep notes for a Lewis University M.S. Business "
                 "Analytics student exploring data/ML careers, using the Post Grad Project 3-step formula: "
                 "Intro (3-4 facts about her + why she wants to talk) → questions about Their Story → the "
                 "Industry/Role → Closing 'things I can do' asks (recruiting timeline, skills to build, referral, "
                 "reach back out). Output 5-7 short bullet questions. No preamble.")
        user_p = f"Company: {company}\nRole: {role}\nJD (optional):\n{jd[:1500]}\n\nWrite the note-sheet."
        body = _json.dumps({"model": "gpt-4o-mini",
                            "messages": [{"role": "system", "content": sys_p}, {"role": "user", "content": user_p}],
                            "temperature": 0.4, "max_tokens": 600}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body,
                                     headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=40) as r:
            return _json.load(r)["choices"][0]["message"]["content"].strip()
    except Exception:
        return None

# ── Generate tailored CV (docx + try PDF) ────────────────────────────────────
def generate_cv(company: str, jd: str, missing: list, want_pdf: bool = False, md_path: str = None, suffix: str = ""):
    """Generate docx from a CV markdown (md_path, or base cv.md) + inject missing keywords.
    `suffix` makes the filename unique so concurrent candidates don't overwrite each other."""
    slug = re.sub(r"[^a-z0-9]+", "-", company.lower()).strip("-") or "job"
    today = date.today().isoformat()
    docx = OUTPUT / f"cv-andrea-{slug}-{today}{suffix}.docx"
    pdf  = OUTPUT / f"cv-andrea-{slug}-{today}{suffix}.pdf"
    gaps = Path(f"/tmp/gaps-{slug}{suffix}.json")
    kw = [m["keyword"] if isinstance(m, dict) else m for m in missing]
    # "Why <company>" keywords = the brand/product/location-ish missing words that don't
    # belong in skills but CAN appear legitimately as genuine interest in the company.
    skills_skip = {"remote","required","around","even","benefits","united","states","range",
                   "including","interviews","equal","one","great","plus","nice","many","doing",
                   "them","throughout","deeply","embedded","culture","hundreds","disciplines"}
    why_kw = [k for k in kw if k.lower() in {
        "tesla","autopilot","superchargers","cars","energy","storage","devices","grid",
        "electrical","fleet","vehicles","vehicle","palo","alto","california","products",
        "customers","safer","platform","mission","frontier","enterprises","adoption",
        company.lower()} ][:20]
    gaps.write_text(json.dumps({"missing": kw, "company": company, "why_keywords": why_kw}))

    cmd = ["node", str(GEN_CV), "--out", str(docx), "--gaps", str(gaps)]
    if md_path:
        cmd += ["--md", str(md_path)]
    try:
        subprocess.run(cmd, capture_output=True, text=True, cwd=BASE, timeout=120)
    except Exception as e:
        return {"docx": None, "pdf": None, "error": str(e)}

    # PDF via Word is opt-in only (AppleEvent is slow/flaky from a server context).
    pdf_ok = False
    if want_pdf and docx.exists():
        applescript = f'''tell application "Microsoft Word"
  open "{docx}"
  set d to active document
  save as d file name "{pdf}" file format format PDF
  close d saving no
end tell'''
        try:
            subprocess.run(["osascript", "-e", applescript], capture_output=True, text=True, timeout=45)
            pdf_ok = pdf.exists()
        except Exception:
            pdf_ok = pdf.exists()
    return {"docx": docx.name if docx.exists() else None,
            "pdf": pdf.name if pdf_ok else None}

# ── Dashboard HTML ───────────────────────────────────────────────────────────
DASHBOARD = """<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Career Autopilot</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
body{background:#0a0a0f;color:#e8e8ef;min-height:100vh}
.nav{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;border-bottom:1px solid #1c1c28;background:#0d0d14}
.logo{font-size:20px;font-weight:700}.logo span{color:#6366f1}
.badge{background:#16162a;color:#a5b4fc;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:600}
.container{max-width:1100px;margin:0 auto;padding:32px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
.stat{background:#111120;border:1px solid #1c1c28;border-radius:14px;padding:20px}
.stat .num{font-size:32px;font-weight:700;color:#fff}.stat .lbl{font-size:13px;color:#8888a0;margin-top:4px}
.num.green{color:#34d399}.num.indigo{color:#818cf8}.num.amber{color:#fbbf24}
.card{background:#111120;border:1px solid #1c1c28;border-radius:16px;padding:24px;margin-bottom:24px}
.card h2{font-size:16px;margin-bottom:14px}
.steps{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
.step{flex:1;min-width:120px;background:#0a0a0f;border:1px solid #25253a;border-radius:10px;padding:10px 12px;font-size:12px;color:#8888a0}
.step.active{border-color:#6366f1;color:#a5b4fc}.step.done{border-color:#34d399;color:#34d399}
.step b{display:block;color:#e8e8ef;font-size:13px;margin-bottom:2px}
.row{display:flex;gap:10px;margin-bottom:10px}
input,textarea{width:100%;background:#0a0a0f;border:1px solid #25253a;border-radius:10px;padding:12px;color:#e8e8ef;font-size:14px}
textarea{resize:vertical;min-height:120px}input:focus,textarea:focus{outline:none;border-color:#6366f1}
.btn{background:#6366f1;color:#fff;border:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:.15s}
.btn:hover{background:#4f46e5}.btn:disabled{opacity:.5;cursor:wait}
.btn.ghost{background:#16162a;color:#a5b4fc}.btn.green{background:#059669}.btn.green:hover{background:#047857}
.btns{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
.result{margin-top:20px;display:none}
.score-ring{display:flex;align-items:center;gap:20px;margin-bottom:14px}
.ring{width:88px;height:88px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;flex-shrink:0}
.bar{flex:1}.meta{font-size:13px;color:#8888a0;margin-top:6px}
.kw{display:inline-block;background:#2a1616;color:#fca5a5;padding:4px 10px;border-radius:6px;font-size:12px;margin:3px}
.lbl2{font-size:13px;color:#8888a0;margin:14px 0 8px;font-weight:600}
.dl{display:inline-block;margin:6px 8px 0 0;padding:8px 14px;background:#14241c;color:#34d399;border-radius:8px;font-size:13px;text-decoration:none}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:12px;color:#8888a0;padding:10px;border-bottom:1px solid #1c1c28}
td{padding:12px 10px;border-bottom:1px solid #15151f;font-size:14px}
.tag{padding:3px 9px;border-radius:6px;font-size:12px;font-weight:600;background:#1c1c2a;color:#a5b4fc}
.fchip{background:#16162a;color:#8888a0;border:1px solid #25253a;border-radius:20px;padding:5px 13px;font-size:12px;font-weight:600;cursor:pointer;transition:.15s}
.fchip:hover{border-color:#6366f1;color:#a5b4fc}
.fchip.active{background:#6366f1;color:#fff;border-color:#6366f1}
.fchip.active-green{background:#059669;color:#fff;border-color:#059669}
.fchip.active-amber{background:#d97706;color:#fff;border-color:#d97706}
.empty{text-align:center;color:#55556a;padding:32px;font-size:14px}
</style></head><body>
<div class="nav"><div class="logo">⚡ Career <span>Autopilot</span></div><div class="badge">Andrea Estrella · 400 jobs/month</div></div>
<div class="container">
<div class="stats">
<div class="stat"><div class="num" id="s-total">0</div><div class="lbl">Jobs in queue</div></div>
<div class="stat"><div class="num green" id="s-cv">0</div><div class="lbl">CVs generated</div></div>
<div class="stat"><div class="num indigo" id="s-avg">—</div><div class="lbl">Avg ATS</div></div>
<div class="stat"><div class="num amber">13</div><div class="lbl">Daily goal</div></div>
</div>
<div class="card">
<h2>⭐ Wishlist — Priority companies <span style="font-size:12px;color:#8888a0;font-weight:400">· always scanned first</span></h2>
<div id="wlTags" style="margin-bottom:10px"></div>
<div class="row" style="gap:8px">
<input id="wlInput" placeholder="Add company (e.g. Nvidia, HuggingFace...)" style="flex:1" onkeydown="if(event.key==='Enter')addWishlist()">
<button class="btn" onclick="addWishlist()" style="background:#6366f1">+ Add</button>
</div>
</div>
<div class="card">
<h2>🔍 Job Scanner</h2>
<p style="font-size:13px;color:#8888a0;margin-bottom:12px">Search openings across 129 companies (Greenhouse · Ashby · Lever) and add them to your queue. No login, zero risk.</p>
<div class="row">
<input id="scankw" placeholder="Keywords (e.g. data analytics intern)" value="data analytics intern" style="flex:1">
<button class="btn ghost" id="scan" onclick="scanJobs()">🔍 Scan</button>
<button class="btn" id="digest" onclick="runDigest()" style="background:#059669">🎯 Curated Digest</button>
<a class="btn ghost" href="/api/export" style="text-decoration:none">📊 Export applied (CSV)</a>
</div>
<div id="scanres" style="font-size:13px;color:#8888a0;margin-top:8px"></div>
</div>
<div class="card">
<h2>🚀 Full Pipeline</h2>
<div class="steps">
<div class="step active" id="st1"><b>1 · Analyze</b>ATS vs your CV</div>
<div class="step" id="st2"><b>2 · Save</b>to queue</div>
<div class="step" id="st3"><b>3 · Generate CV</b>tailored + keywords</div>
<div class="step" id="st4"><b>4 · Download</b>docx / PDF</div>
</div>
<div class="row">
<input id="company" placeholder="Company (e.g. Tesla)" style="flex:1">
<input id="role" placeholder="Role (e.g. Data Engineer)" style="flex:1">
</div>
<textarea id="jd" placeholder="Paste the full job description here..."></textarea>
<div class="btns">
<button class="btn" id="run" onclick="runATS()">1 · Analyze ATS</button>
<button class="btn green" id="gen" onclick="genCV()" disabled>3 · Generate tailored CV</button>
</div>
<div class="result" id="result">
  <div class="score-ring">
    <div class="ring" id="ring">0%</div>
    <div class="bar"><div class="meta" id="meta"></div>
    <div class="lbl2">❌ Missing keywords (fixable)</div><div id="missing"></div></div>
  </div>
  <div id="downloads"></div>
</div>
</div>
<div class="card" style="border-color:#2d2d52;background:linear-gradient(180deg,#14142a,#111120)">
<h2>⭐ Top 5 — Best matches for your resume</h2>
<div id="top5" style="font-size:13px;color:#8888a0">Prepare some jobs to see your best matches here…</div>
</div>
<div class="card">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
<h2 style="margin:0">📋 Application Queue <span style="font-size:12px;color:#8888a0;font-weight:400">· sorted by best fit</span></h2>
<span id="fCount" style="font-size:12px;color:#8888a0"></span>
</div>
<input id="fLoc" placeholder="🔎 Filter by location, company or role..." oninput="loadJobs()" style="width:100%;background:#0a0a0f;border:1px solid #25253a;border-radius:8px;padding:10px;color:#e8e8ef;font-size:14px;margin-bottom:12px">
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;align-items:center">
<span style="font-size:12px;color:#8888a0;font-weight:600">STATUS:</span>
<button class="fchip active" id="chip-all" onclick="setStatus('',this)">All</button>
<button class="fchip" id="chip-discovered" onclick="setStatus('discovered',this)">🆕 New</button>
<button class="fchip" id="chip-cv_generated" onclick="setStatus('cv_generated',this)">📄 CV Ready</button>
<button class="fchip" id="chip-applied" onclick="setStatus('applied',this)">✅ Applied</button>
</div>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">
<span style="font-size:12px;color:#8888a0;font-weight:600">DATE:</span>
<button class="fchip active" id="date-0" onclick="setDate(0,this)">Any</button>
<button class="fchip" id="date-24" onclick="setDate(24,this)">24h</button>
<button class="fchip" id="date-72" onclick="setDate(72,this)">72h</button>
<button class="fchip" id="date-168" onclick="setDate(168,this)">7d</button>
<span style="font-size:12px;color:#8888a0;font-weight:600;margin-left:8px">FIT:</span>
<button class="fchip active" id="fit-0" onclick="setFit(0,this)">All</button>
<button class="fchip" id="fit-50" onclick="setFit(50,this)">50%+</button>
<button class="fchip" id="fit-70" onclick="setFit(70,this)">70%+</button>
<span style="font-size:12px;color:#8888a0;font-weight:600;margin-left:8px">EXTRA:</span>
<button class="fchip" id="chip-remote" onclick="toggleChip(this,'remote')">Remote</button>
<button class="fchip" id="chip-prepared" onclick="toggleChip(this,'prepared')">Has CV</button>
<button class="fchip" id="chip-cptopt" onclick="toggleChip(this,'cptopt')" title="Companies known to accept F-1 CPT/OPT students">🎓 CPT/OPT</button>
<input type="hidden" id="fCptOpt" value="0">
</div>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">
<span style="font-size:12px;color:#8888a0;font-weight:600">SOURCE:</span>
<button class="fchip active" id="src-all" onclick="setSource('',this)">All</button>
<button class="fchip" id="src-greenhouse" onclick="setSource('greenhouse',this)">🌱 Greenhouse</button>
<button class="fchip" id="src-ashby" onclick="setSource('ashby',this)">🔵 Ashby</button>
<button class="fchip" id="src-lever" onclick="setSource('lever',this)">🟠 Lever</button>
<button class="fchip" id="src-indeed" onclick="setSource('indeed',this)">🔍 Indeed</button>
<button class="fchip" id="src-remoteok" onclick="setSource('remoteok',this)">🌐 RemoteOK</button>
<button class="fchip" id="src-ycombinator" onclick="setSource('ycombinator',this)">🚀 YC HN</button>
<button class="fchip" id="src-workday" onclick="setSource('workday',this)">🏢 Workday</button>
<button class="fchip" id="src-manual" onclick="setSource('manual',this)">✍️ Manual</button>
<input type="hidden" id="fSource" value="">
</div>
<input type="hidden" id="fStatus" value="">
<input type="hidden" id="fDate" value="0">
<input type="hidden" id="fFit" value="0">
<input type="hidden" id="fRemote" value="0">
<input type="hidden" id="fPrepared" value="0">
<table><thead><tr><th>Company</th><th>Role</th><th>Source</th><th>Location</th><th>Posted</th><th>ATS</th><th>Fit (AI)</th><th>CV</th><th>Status</th><th>Actions</th></tr></thead>
<tbody id="jobs"><tr><td colspan="10" class="empty">No jobs yet — scan or analyze a JD above 🚀</td></tr></tbody></table>
</div>
</div>
<div id="contactModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
<div style="background:#111120;border:1px solid #2d2d52;border-radius:16px;padding:24px;max-width:680px;width:92%;max-height:86vh;overflow:auto">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
<h2 id="cmTitle" style="font-size:16px">👥 Contacts & Outreach</h2>
<button onclick="document.getElementById('contactModal').style.display='none'" style="background:none;border:none;color:#8888a0;font-size:22px;cursor:pointer">×</button>
</div>
<div id="cmBody" style="font-size:13px;color:#b8b8c8"></div>
</div></div>
<script src="/jobs.js"></script>
<script src="/app.js"></script></body></html>"""

# ── HTTP server ───────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, body, ctype="application/json", raw=False):
        data = body if raw else (body.encode() if isinstance(body, str) else body)
        self.send_response(code)
        ct = ctype + ("; charset=utf-8" if "text" in ctype or "javascript" in ctype else "")
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        p = urlparse(self.path)
        path = p.path
        if path == "/api/wishlist":
            import scanner
            self._send(200, json.dumps([w["name"] for w in scanner.WISHLIST]))
            return
        if path == "/app.js":
            js_file = BASE / "app.js"
            self._send(200, js_file.read_text(encoding="utf-8"), "application/javascript")
            return
        if path == "/jobs.js":
            con = db()
            rows = [dict(r) for r in con.execute(
                "SELECT id,title,company,location,url,platform,ats_score,semantic_score,"
                "recommendation,cv_file,status,created_at,posted_at "
                "FROM jobs ORDER BY semantic_score DESC NULLS LAST, ats_score DESC NULLS LAST, created_at DESC "
                "LIMIT 500").fetchall()]
            con.close()
            self._send(200, "var PRELOADED_JOBS=" + json.dumps(rows) + ";", "application/javascript")
            return
        if path in ("/", "/dashboard"):
            self._send(200, DASHBOARD, "text/html")
        elif path == "/api/jobs":
            # Return slim rows (no jd_text) to avoid BrokenPipe on large payloads
            con = db()
            rows = [dict(r) for r in con.execute(
                "SELECT id,title,company,location,url,platform,ats_score,semantic_score,"
                "recommendation,cv_file,status,created_at,posted_at "
                "FROM jobs ORDER BY semantic_score DESC NULLS LAST, ats_score DESC NULLS LAST, created_at DESC "
                "LIMIT 500").fetchall()]
            con.close()
            self._send(200, json.dumps(rows))
        elif path == "/api/health":
            self._send(200, json.dumps({"ok": True, "cv_loaded": bool(read_cv())}))
        elif path == "/api/export":
            # CSV of applied / prepared jobs (for Drive/Excel)
            import csv, io
            con = db()
            rows = [dict(r) for r in con.execute(
                "SELECT company,title,location,posted_at,ats_score,semantic_score,recommendation,status,url FROM jobs "
                "WHERE status IN ('applied','cv_generated') ORDER BY created_at DESC").fetchall()]
            con.close()
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow(["Company", "Role", "Location", "Posted", "ATS %", "Fit %", "Recommendation", "Status", "URL"])
            for r in rows:
                w.writerow([r["company"], r["title"], r["location"], r["posted_at"],
                            r["ats_score"], r["semantic_score"], r["recommendation"], r["status"], r["url"]])
            self.send_response(200)
            self.send_header("Content-Type", "text/csv")
            self.send_header("Content-Disposition", 'attachment; filename="applications.csv"')
            self.end_headers()
            self.wfile.write(buf.getvalue().encode())
        elif path == "/api/download":
            q = parse_qs(p.query); fname = (q.get("file") or [""])[0]
            fpath = OUTPUT / os.path.basename(fname)
            if fpath.exists():
                ctype = "application/pdf" if fpath.suffix == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                self.send_response(200); self.send_header("Content-Type", ctype)
                self.send_header("Content-Disposition", f'attachment; filename="{fpath.name}"')
                self.end_headers(); self.wfile.write(fpath.read_bytes())
            else:
                self._send(404, json.dumps({"error": "file not found"}))
        else:
            self._send(404, json.dumps({"error": "not found"}))

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length) or "{}")
        path = urlparse(self.path).path
        if path == "/api/ats":
            self._send(200, json.dumps(check_ats(data.get("jd", ""))))
        elif path == "/api/scan":
            kw = data.get("keywords", "data analytics intern engineer")
            jobs = scan_jobs(kw, limit=int(data.get("limit", 150)))
            if isinstance(jobs, dict) and jobs.get("error"):
                self._send(200, json.dumps(jobs)); return
            con = db(); added = 0
            for j in jobs:
                exists = con.execute("SELECT 1 FROM jobs WHERE url=?", (j["url"],)).fetchone()
                if exists: continue
                con.execute("INSERT INTO jobs (title,company,location,url,platform,jd_text,posted_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                    (j["title"], j["company"], j["location"], j["url"], j["platform"], j.get("jd", ""), j.get("posted",""), "discovered", datetime.now().isoformat()))
                added += 1
            con.commit(); con.close()
            if added:
                notify_discord(f"🔍 Scan complete — **{added} new jobs** added to your queue ({len(jobs)} found for \"{kw}\").", title="🔍 New jobs scanned")
            self._send(200, json.dumps({"found": len(jobs), "added": added, "jobs": jobs[:60]}))
        elif path == "/api/digest":
            res = daily_digest(notify=True)
            self._send(200, json.dumps(res))
        elif path == "/api/wishlist" and self.command == "GET":
            import scanner
            self._send(200, json.dumps([w["name"] for w in scanner.WISHLIST]))
            return
        elif path == "/api/wishlist":
            action = data.get("action"); name = (data.get("name") or "").strip()
            if action in ("add", "remove") and name:
                import scanner as _sc
                slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
                provider, region = "greenhouse", "us"
                try:
                    r2 = _get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
                    if r2.get("jobs") is not None: provider = "ashby"; region = None
                except Exception: pass
                if action == "add":
                    if not any(w["name"].lower() == name.lower() for w in _sc.WISHLIST):
                        _sc.WISHLIST.append({"name": name, "provider": provider, "slug": slug, "region": region})
                        _sc.WISHLIST_COMPANY_NAMES.add(name.lower())
                else:
                    _sc.WISHLIST[:] = [w for w in _sc.WISHLIST if w["name"].lower() != name.lower()]
                    _sc.WISHLIST_COMPANY_NAMES.discard(name.lower())
                self._send(200, json.dumps([w["name"] for w in _sc.WISHLIST])); return
            kw = data.get("keywords", "data analytics intern engineer")
            jobs = scan_jobs(kw, limit=int(data.get("limit", 60)))
            if isinstance(jobs, dict) and jobs.get("error"):
                self._send(200, json.dumps(jobs)); return
            con = db()
            added = 0
            for j in jobs:
                exists = con.execute("SELECT 1 FROM jobs WHERE url=?", (j["url"],)).fetchone()
                if exists:
                    continue
                con.execute("INSERT INTO jobs (title,company,location,url,platform,jd_text,posted_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                    (j["title"], j["company"], j["location"], j["url"], j["platform"], j.get("jd", ""), j.get("posted", ""), "discovered", datetime.now().isoformat()))
                added += 1
            con.commit(); con.close()
            if added:
                notify_discord(f"🔍 Scan complete — **{added} new jobs** added to your queue "
                               f"({len(jobs)} found for \"{kw}\").", title="🔍 New jobs scanned")
            self._send(200, json.dumps({"found": len(jobs), "added": added, "jobs": jobs[:60]}))
        elif path == "/api/jobs":
            con = db()
            con.execute("INSERT INTO jobs (title,company,location,url,platform,jd_text,ats_score,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (data.get("title"), data.get("company"), data.get("location"), data.get("url"),
                 data.get("platform", "manual"), data.get("jd_text"), data.get("ats_score"),
                 "analyzed", datetime.now().isoformat()))
            con.commit(); con.close()
            self._send(200, json.dumps({"ok": True}))
        elif path == "/api/generate":
            res = generate_cv(data.get("company", "job"), data.get("jd", ""), data.get("missing", []))
            # mark latest matching job with cv file
            con = db()
            con.execute("UPDATE jobs SET cv_file=?, status='cv_generated' WHERE id=(SELECT id FROM jobs WHERE company=? ORDER BY created_at DESC LIMIT 1)",
                        (res.get("pdf") or res.get("docx"), data.get("company", "job")))
            con.commit(); con.close()
            self._send(200, json.dumps(res))
        elif path == "/api/prepare":
            # For a queued job: run ATS on its stored JD + generate tailored CV
            con = db()
            row = con.execute("SELECT * FROM jobs WHERE id=?", (data.get("id"),)).fetchone()
            if not row:
                con.close(); self._send(404, json.dumps({"error": "job not found"})); return
            job = dict(row)
            jd = job.get("jd_text") or ""
            if not jd:
                con.close(); self._send(200, json.dumps({"error": "no JD stored for this job — open it and paste the JD manually"})); return
            company, role = job["company"], job.get("title", "")
            before = check_ats(jd)                       # score of base cv.md

            def score_docx(cv):
                dp = OUTPUT / (cv.get("docx") or "")
                if not dp.exists():
                    return 0.0, []
                txt = docx_text(dp)
                if not txt:
                    return 0.0, []
                tf = Path(f"/tmp/cvtxt-{job['id']}.txt"); tf.write_text(txt)
                a = check_ats(jd, cv_path=str(tf))
                return a["score"], a["missing"]

            # floor: base + keyword injection (unique filename so it isn't overwritten)
            base_cv = generate_cv(company, jd, before.get("missing", []), md_path=None, suffix="-base")
            bsc, bmiss = score_docx(base_cv)
            best = {"score": bsc, "cv": base_cv, "missing": bmiss, "md": None}

            # AI tailoring with iterative refinement (replicates the manual method).
            try:
                import ai_tailor
                base_md = read_cv()
                prev_md = None
                cur_missing_kw = [m["keyword"] for m in before.get("missing", [])]
                for rnd in range(2):                      # up to 2 AI passes
                    tailored = ai_tailor.tailor_cv(jd, base_md, company, role,
                                                   missing_keywords=cur_missing_kw, prev_cv_md=prev_md)
                    prev_md = tailored
                    md_file = Path(f"/tmp/cv-tailored-{job['id']}.md"); md_file.write_text(tailored)
                    cv = generate_cv(company, jd, best["missing"], md_path=str(md_file), suffix=f"-ai{rnd}")
                    sc, miss = score_docx(cv)
                    if sc > best["score"]:
                        best = {"score": sc, "cv": cv, "missing": miss, "md": str(md_file)}
                    cur_missing_kw = [m["keyword"] for m in miss]
                    if sc >= 95 or not miss:
                        break
            except Exception:
                pass

            # FINAL TOP-UP: re-inject the best CV's OWN measured missing keywords
            # (fixes the lag where injected gaps were from a previous iteration).
            try:
                for tries in range(2):
                    cv2 = generate_cv(company, jd, best["missing"], md_path=best.get("md"), suffix=f"-top{tries}")
                    sc2, miss2 = score_docx(cv2)
                    if sc2 > best["score"]:
                        best = {"score": sc2, "cv": cv2, "missing": miss2, "md": best.get("md")}
                    else:
                        break
                    if sc2 >= 95 or not miss2:
                        break
            except Exception:
                pass

            # Copy the BEST candidate to the canonical filename (this is what gets downloaded)
            cv = best["cv"] or base_cv
            try:
                import shutil
                slug = re.sub(r"[^a-z0-9]+", "-", company.lower()).strip("-") or "job"
                final_name = f"cv-andrea-{slug}-{date.today().isoformat()}.docx"
                if cv.get("docx"):
                    shutil.copy(OUTPUT / cv["docx"], OUTPUT / final_name)
                    cv = {"docx": final_name, "pdf": None}
            except Exception:
                pass
            # SkillSyncer semantic validation on the FINAL CV (GPT-4o)
            sem = {"semantic": None, "recommendation": None}
            final_docx = OUTPUT / (cv.get("docx") or "")
            if final_docx.exists():
                txt = docx_text(final_docx)
                if txt:
                    tf = Path(f"/tmp/cvfinal-{job['id']}.txt"); tf.write_text(txt)
                    sem = skillsyncer(clean_jd(jd), str(tf))
            con.execute("UPDATE jobs SET ats_score=?, semantic_score=?, recommendation=?, cv_file=?, status='cv_generated' WHERE id=?",
                        (best["score"], sem.get("semantic"), sem.get("recommendation"),
                         cv.get("pdf") or cv.get("docx"), job["id"]))
            con.commit(); con.close()
            notify_discord(f"📄 CV ready for **{company} — {role}**\n"
                           f"Keyword ATS: {round(best['score'])}% · Semantic fit: {sem.get('semantic')}% · "
                           f"{sem.get('recommendation') or ''}", title="📄 CV tailored")
            self._send(200, json.dumps({"before": before["score"], "score": best["score"],
                                        "semantic": sem.get("semantic"),
                                        "recommendation": sem.get("recommendation"),
                                        "missing": [m["keyword"] for m in best["missing"][:25]],
                                        "docx": cv.get("docx"), "pdf": cv.get("pdf")}))
        elif path == "/api/fill":
            # Launch the assisted Playwright form-filler (opens browser, fills, PAUSES before submit)
            con = db()
            row = con.execute("SELECT * FROM jobs WHERE id=?", (data.get("id"),)).fetchone()
            con.close()
            if not row:
                self._send(404, json.dumps({"error": "job not found"})); return
            job = dict(row)
            url = job.get("url", "")
            if not url:
                self._send(200, json.dumps({"error": "no URL for this job"})); return
            cv = OUTPUT / (job.get("cv_file") or "")
            cmd = ["node", "apply_filler.mjs", "--url", url]
            if cv.exists():
                cmd += ["--cv", str(cv)]
            try:
                subprocess.Popen(cmd, cwd=BASE)  # background; keeps browser open
                self._send(200, json.dumps({"ok": True, "url": url}))
            except Exception as e:
                self._send(200, json.dumps({"error": str(e)}))
        elif path == "/api/contact":
            con = db()
            row = con.execute("SELECT * FROM jobs WHERE id=?", (data.get("id"),)).fetchone()
            con.close()
            if not row:
                self._send(404, json.dumps({"error": "job not found"})); return
            job = dict(row)
            pack = contact_pack(job["company"], job["title"])
            pack["notes"] = conversation_notes(job["company"], job["title"], job.get("jd_text", ""))
            pack["company"] = job["company"]
            pack["role"] = job["title"]
            self._send(200, json.dumps(pack))
        elif path == "/api/apply":
            # Open the posting in the browser and mark as applied (user submits)
            con = db()
            row = con.execute("SELECT * FROM jobs WHERE id=?", (data.get("id"),)).fetchone()
            if not row:
                con.close(); self._send(404, json.dumps({"error": "job not found"})); return
            job = dict(row)
            url = job.get("url", "")
            if url:
                # open as a NEW TAB in the existing Chrome window (no new window / no other browser)
                script = f'''tell application "Google Chrome"
  activate
  if (count of windows) = 0 then
    make new window
    set URL of active tab of front window to "{url}"
  else
    tell front window to make new tab with properties {{URL:"{url}"}}
  end if
end tell'''
                try:
                    subprocess.run(["osascript", "-e", script], capture_output=True, timeout=10)
                except: pass
            con.execute("UPDATE jobs SET status='applied' WHERE id=?", (data.get("id"),))
            con.commit(); con.close()
            notify_discord(f"✅ Applied to **{job.get('company')} — {job.get('title')}**\n{url}",
                           title="✅ Application opened", color=3463016)
            self._send(200, json.dumps({"ok": True, "opened": url}))
        else:
            self._send(404, json.dumps({"error": "not found"}))

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 8800))
    print(f"⚡ Career Autopilot (full pipeline) → http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
