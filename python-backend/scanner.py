"""
Zero-token job scanner — hits public Greenhouse / Ashby / Lever job-board APIs
for the companies tracked in career-ops/portals.yml, filters by keywords, and
returns normalized jobs. No login, no scraping, no ToS issues.
"""
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

CAREER_OPS = Path("/Users/andrea_star/Desktop/Applications/career-ops")

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# ── Wishlist: always scanned first, regardless of keywords ───────────────────
WISHLIST = [
    # Explicitly provided in conv / high-priority targets
    {"name": "Tesla",       "provider": "greenhouse", "slug": "tesla",       "region": "us"},
    {"name": "Anthropic",   "provider": "greenhouse", "slug": "anthropic",   "region": "us"},
    {"name": "Figma",       "provider": "greenhouse", "slug": "figma",       "region": "us"},
    {"name": "Stripe",      "provider": "greenhouse", "slug": "stripe",      "region": "us"},
    {"name": "Datadog",     "provider": "greenhouse", "slug": "datadog",     "region": "us"},
    {"name": "MongoDB",     "provider": "greenhouse", "slug": "mongodb",     "region": "us"},
    {"name": "Cloudflare",  "provider": "greenhouse", "slug": "cloudflare",  "region": "us"},
    {"name": "Brex",        "provider": "greenhouse", "slug": "brex",        "region": "us"},
    {"name": "Duolingo",    "provider": "greenhouse", "slug": "duolingo",    "region": "us"},
    {"name": "Robinhood",   "provider": "greenhouse", "slug": "robinhood",   "region": "us"},
    {"name": "OpenAI",      "provider": "ashby",      "slug": "openai",      "region": None},
    {"name": "Cohere",      "provider": "ashby",      "slug": "cohere",      "region": None},
    {"name": "Perplexity",  "provider": "ashby",      "slug": "perplexity",  "region": None},
    {"name": "Cursor",      "provider": "ashby",      "slug": "cursor",      "region": None},
    {"name": "LangChain",   "provider": "ashby",      "slug": "langchain",   "region": None},
    {"name": "LlamaIndex",  "provider": "ashby",      "slug": "llamaindex",  "region": None},
    {"name": "Runway",      "provider": "ashby",      "slug": "runway",      "region": None},
    {"name": "Palantir",    "provider": "lever",      "slug": "palantir",    "region": None},
    {"name": "Spotify",     "provider": "lever",      "slug": "spotify",     "region": None},
    # Already in portals.yml but guaranteed to be checked:
    {"name": "Decagon",     "provider": "ashby",      "slug": "decagon",     "region": None},
    {"name": "Sierra",      "provider": "ashby",      "slug": "sierra",      "region": None},
    {"name": "Beacon Software", "provider": "ashby",  "slug": "beaconsoftware", "region": None},
    {"name": "ElevenLabs",  "provider": "ashby",      "slug": "elevenlabs",  "region": None},
    # New additions — verified working
    {"name": "Scale AI",    "provider": "greenhouse", "slug": "scaleai",     "region": "us"},
    {"name": "Snowflake",   "provider": "ashby",      "slug": "snowflake",   "region": None},
    {"name": "Databricks",  "provider": "greenhouse", "slug": "databricks",  "region": "us"},
    {"name": "Glean",       "provider": "greenhouse", "slug": "gleanwork",   "region": "us"},
    {"name": "Notion",      "provider": "ashby",      "slug": "notion",      "region": None},
    {"name": "Airtable",    "provider": "greenhouse", "slug": "airtable",    "region": "us"},
    {"name": "Mistral",     "provider": "lever",      "slug": "mistral",     "region": None},
    {"name": "Replit",      "provider": "ashby",      "slug": "replit",      "region": None},
    {"name": "Harvey AI",   "provider": "ashby",      "slug": "harvey",      "region": None},
    {"name": "Writer",      "provider": "ashby",      "slug": "writer",      "region": None},
    {"name": "Pika Labs",   "provider": "ashby",      "slug": "pika",        "region": None},
]

# ── Extra companies beyond portals.yml ───────────────────────────────────────
WISHLIST_COMPANY_NAMES = {w["name"].lower() for w in WISHLIST}

EXTRA_COMPANIES = [
    # Greenhouse (verified working)
    ("Figma",       "greenhouse", "figma",       "us"),
    ("Stripe",      "greenhouse", "stripe",      "us"),
    ("Brex",        "greenhouse", "brex",        "us"),
    ("Robinhood",   "greenhouse", "robinhood",   "us"),
    ("Duolingo",    "greenhouse", "duolingo",    "us"),
    ("MongoDB",     "greenhouse", "mongodb",     "us"),
    ("Elastic",     "greenhouse", "elastic",     "us"),
    ("PagerDuty",   "greenhouse", "pagerduty",   "us"),
    ("Cloudflare",  "greenhouse", "cloudflare",  "us"),
    ("Datadog",     "greenhouse", "datadog",     "us"),
    ("Twilio",      "greenhouse", "twilio",      "us"),
    ("Databricks",  "greenhouse", "databricks",  "us"),
    ("Scale AI",    "greenhouse", "scaleai",     "us"),
    ("Glean",       "greenhouse", "gleanwork",   "us"),
    ("Arize AI",    "greenhouse", "arizeai",     "us"),
    ("Anthropic",   "greenhouse", "anthropic",   "us"),
    ("RunPod",      "greenhouse", "runpod",      "us"),
    ("Airtable",    "greenhouse", "airtable",    "us"),
    ("Vercel",      "greenhouse", "vercel",      "us"),
    ("Mixpanel",    "greenhouse", "mixpanel",    "us"),
    ("Amplitude",   "greenhouse", "amplitude",   "us"),
    ("Klaviyo",     "greenhouse", "klaviyo",     "us"),
    ("Asana",       "greenhouse", "asana",       "us"),
    ("Lattice",     "greenhouse", "lattice",     "us"),
    ("Intercom",    "greenhouse", "intercom",    "us"),
    # Ashby (verified working)
    ("OpenAI",      "ashby",      "openai",      None),
    ("Perplexity",  "ashby",      "perplexity",  None),
    ("Cursor",      "ashby",      "cursor",      None),
    ("Linear",      "ashby",      "linear",      None),
    ("LangChain",   "ashby",      "langchain",   None),
    ("LlamaIndex",  "ashby",      "llamaindex",  None),
    ("Runway ML",   "ashby",      "runway",      None),
    ("Pika",        "ashby",      "pika",        None),
    ("Snowflake",   "ashby",      "snowflake",   None),
    ("Notion",      "ashby",      "notion",      None),
    ("Replit",      "ashby",      "replit",      None),
    ("Harvey AI",   "ashby",      "harvey",      None),
    ("Writer",      "ashby",      "writer",      None),
    ("Vapi",        "ashby",      "vapi",        None),
    ("Klue",        "ashby",      "klue",        None),
    # Lever (verified working)
    ("Palantir",    "lever",      "palantir",    None),
    ("Spotify",     "lever",      "spotify",     None),
    ("Mistral",     "lever",      "mistral",     None),
    # New Greenhouse (verified)
    ("Waymo",       "greenhouse", "waymo",       "us"),
    ("CoreWeave",   "greenhouse", "coreweave",   "us"),
    ("SoFi",        "greenhouse", "sofi",        "us"),
    ("Fivetran",    "greenhouse", "fivetran",    "us"),
    ("Motional",    "greenhouse", "motional",    "us"),
    ("Gusto",       "greenhouse", "gusto",       "us"),
    ("Chime",       "greenhouse", "chime",       "us"),
    ("Hightouch",   "greenhouse", "hightouch",   "us"),
    ("Mercury",     "greenhouse", "mercury",     "us"),
    ("Coinbase",    "greenhouse", "coinbase",    "us"),
    ("Gemini",      "greenhouse", "gemini",      "us"),
    ("Starburst",   "greenhouse", "starburst",   "us"),
    ("Dremio",      "greenhouse", "dremio",      "us"),
    # New Ashby (verified)
    ("Ramp",        "ashby",      "ramp",        None),
    ("Zip",         "ashby",      "zip",         None),
    ("Vanta",       "ashby",      "vanta",       None),
    ("Drata",       "ashby",      "drata",       None),
    ("Benchling",   "ashby",      "benchling",   None),
    ("Merge",       "ashby",      "merge",       None),
    ("Deel",        "ashby",      "deel",        None),
    ("Hyperscience","ashby",      "hyperscience",None),
]

# ── Workday companies (CXS API) ───────────────────────────────────────────────
WORKDAY_COMPANIES = [
    # (name, tenant, subdomain, site_path)
    ("Salesforce", "salesforce", "wd12", "External_Career_Site"),
    ("Nvidia",     "nvidia",     "wd5",  "NVIDIAExternalCareerSite"),
    ("Intel",      "intel",      "wd1",  "External"),
]


def _get(url, timeout=12):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _check_liveness(url: str, timeout: int = 6) -> bool:
    """Lightweight HTTP liveness check — returns False if job is 404/gone."""
    if not url:
        return True  # can't check → assume alive
    try:
        req = urllib.request.Request(url, headers=UA, method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status < 404
    except Exception:
        try:  # fallback GET
            req2 = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req2, timeout=timeout) as r:
                # If the content is very short (redirect to homepage) it's likely dead
                body = r.read(2000).lower()
                return not any(b in body for b in [b"job not found", b"position has been filled",
                                                    b"no longer accepting", b"role has been closed"])
        except Exception:
            return True  # uncertain → keep it


def _fetch_workday(name: str, tenant: str, sub: str, site: str, keywords: str = "data analytics") -> list:
    """Fetch jobs from Workday CXS API."""
    jobs = []
    url = f"https://{tenant}.{sub}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
    body = json.dumps({"appliedFacets": {}, "limit": 20, "offset": 0, "searchText": keywords}).encode()
    headers = {**UA, "Content-Type": "application/json", "Accept": "application/json"}
    try:
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.load(r)
        for j in data.get("jobPostings", []):
            ext = j.get("externalPath", "") or j.get("bulletFields", [""])[0] if j.get("bulletFields") else ""
            job_url = f"https://{tenant}.{sub}.myworkdayjobs.com{ext}" if ext else ""
            jobs.append({
                "title": j.get("title", ""),
                "company": name,
                "location": j.get("locationsText", ""),
                "url": job_url,
                "platform": "workday",
                "posted": j.get("postedOn", ""),
                "jd": "",
            })
    except Exception:
        pass
    return jobs


def _fetch_jobspy(keywords: str = "data analytics engineer intern scientist") -> list:
    """Fetch jobs from Indeed + Google via jobspy (bypasses API blocks)."""
    jobs = []
    try:
        from jobspy import scrape_jobs
        df = scrape_jobs(
            site_name=["indeed", "google"],
            search_term=keywords,
            location="United States",
            results_wanted=40,
            hours_old=168,  # last 7 days
        )
        SKIP = ["recruiter", "sales rep", "customer success", "hr ", "coordinator",
                "nurse", "driver", "warehouse", "attorney", "paralegal"]
        KEEP = ["data", "analyst", "analytics", "engineer", "scientist", "ml",
                "machine learning", "python", "sql", "intelligence", "intern", "ai "]
        for _, row in df.iterrows():
            title = str(row.get("title", "")).lower()
            if any(s in title for s in SKIP): continue
            if not any(k in title for k in KEEP): continue
            url = str(row.get("job_url", "") or row.get("job_url_direct", ""))
            if not url: continue
            jobs.append({
                "title": str(row.get("title", "")),
                "company": str(row.get("company", "")),
                "location": str(row.get("location", "")),
                "url": url,
                "platform": str(row.get("site", "indeed")),
                "posted": str(row.get("date_posted", "")),
                "jd": str(row.get("description", ""))[:1000] if row.get("description") else "",
            })
    except Exception:
        pass
    return jobs[:30]


def _fetch_remoteok() -> list:
    """Fetch remote jobs from RemoteOK API — free, no auth needed."""
    jobs = []
    tag_sets = ["data-science", "machine-learning", "analytics"]
    seen = set()
    # Must contain one of these in the TITLE (strict match)
    TITLE_REQUIRED = ["data", "analyst", "analytics", "scientist", "engineer",
                      "machine learning", "ml", "python", "sql", "bi ", "intelligence"]
    SKIP = ["hr ", "recruiter", "sales", "marketing manager", "designer",
            "customer success", "office", "coordinator", "driver", "nurse",
            "biologist", "scheduler", "patient", "representative", "technician"]
    for tags in tag_sets:
        try:
            data = _get(f"https://remoteok.com/api?tags={tags}&limit=30")
            for j in data:
                if not isinstance(j, dict) or not j.get("position"): continue
                url = j.get("url") or j.get("apply_url", "")
                if not url or url in seen: continue
                # Fix encoding issues
                title = j.get("position", "").encode("latin-1", errors="replace").decode("utf-8", errors="replace")
                company = j.get("company", "").encode("latin-1", errors="replace").decode("utf-8", errors="replace")
                tl = title.lower()
                if any(s in tl for s in SKIP): continue
                if not any(r in tl for r in TITLE_REQUIRED): continue
                seen.add(url)
                jobs.append({
                    "title": title, "company": company,
                    "location": "Remote", "url": url,
                    "platform": "remoteok", "posted": j.get("date", ""), "jd": "",
                })
        except Exception:
            pass
    return jobs[:30]  # cap at 30 to not overwhelm quality boards


def _fetch_ycombinator_jobs() -> list:
    """Fetch YC Hacker News job stories (current batch)."""
    jobs = []
    try:
        ids = _get("https://hacker-news.firebaseio.com/v0/jobstories.json")
        from concurrent.futures import ThreadPoolExecutor
        def fetch_item(jid):
            try:
                return _get(f"https://hacker-news.firebaseio.com/v0/item/{jid}.json")
            except Exception:
                return None
        with ThreadPoolExecutor(max_workers=8) as ex:
            items = list(ex.map(fetch_item, ids[:40]))
        for item in items:
            if not item or item.get("type") != "job":
                continue
            title = item.get("title", "")
            url = item.get("url") or f"https://news.ycombinator.com/item?id={item['id']}"
            # extract company from title (usually "Company is hiring...")
            company = re.split(r"[|(:]| is | wants | seeking ", title)[0].strip()[:50]
            jobs.append({"title": title, "company": company, "location": "Remote / Various",
                         "url": url, "platform": "ycombinator", "posted": "", "jd": title})
    except Exception:
        pass
    return jobs


def _board_from_url(url: str):
    """Return (provider, slug, region) from a careers URL, or None."""
    if not url:
        return None
    m = re.search(r"greenhouse\.io/([^/?#]+)", url)
    if m:
        region = "eu" if "eu.greenhouse" in url else "us"
        return ("greenhouse", m.group(1), region)
    m = re.search(r"ashbyhq\.com/([^/?#]+)", url)
    if m:
        return ("ashby", m.group(1), None)
    m = re.search(r"lever\.co/([^/?#]+)", url)
    if m:
        return ("lever", m.group(1), None)
    return None


def _strip_html(s):
    return re.sub(r"\s+\n", "\n", re.sub(r"<[^>]+>", " ", s or "")).strip()


def _fetch_company(company, provider, slug, region):
    jobs = []
    try:
        if provider == "greenhouse":
            host = "boards-api.eu.greenhouse.io" if region == "eu" else "boards-api.greenhouse.io"
            data = _get(f"https://{host}/v1/boards/{slug}/jobs?content=true")
            for j in data.get("jobs", []):
                jobs.append({"title": j.get("title", ""), "company": company,
                             "location": (j.get("location") or {}).get("name", ""),
                             "url": j.get("absolute_url", ""), "platform": "greenhouse",
                             "posted": j.get("updated_at") or j.get("first_published") or "",
                             "jd": _strip_html(j.get("content", ""))})
        elif provider == "ashby":
            data = _get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
            for j in data.get("jobs", []):
                jobs.append({"title": j.get("title", ""), "company": company,
                             "location": j.get("location", ""),
                             "url": j.get("jobUrl", ""), "platform": "ashby",
                             "posted": j.get("publishedAt") or j.get("publishedDate") or "",
                             "jd": _strip_html(j.get("descriptionPlain") or j.get("descriptionHtml", ""))})
        elif provider == "lever":
            data = _get(f"https://api.lever.co/v0/postings/{slug}?mode=json")
            for j in data:
                ca = j.get("createdAt")
                posted = ""
                if isinstance(ca, (int, float)):
                    # epoch ms -> ISO (done in Python without datetime.now to stay deterministic)
                    import datetime as _dt
                    posted = _dt.datetime.utcfromtimestamp(ca / 1000).isoformat() + "Z"
                jobs.append({"title": j.get("text", ""), "company": company,
                             "location": (j.get("categories") or {}).get("location", ""),
                             "url": j.get("hostedUrl", ""), "platform": "lever",
                             "posted": posted,
                             "jd": _strip_html(j.get("descriptionPlain") or j.get("description", ""))})
    except Exception:
        pass
    return jobs


def _load_companies():
    import yaml
    d = yaml.safe_load((CAREER_OPS / "portals.yml").read_text())
    raw = d.get("tracked_companies") or d.get("companies") or []
    out = []
    for c in raw:
        if not isinstance(c, dict):
            continue
        name = c.get("name") or c.get("company")
        url = c.get("careers_url") or c.get("url") or ""
        b = _board_from_url(url)
        if name and b:
            out.append((name, *b))
    return out


def scan(keywords="data analytics intern engineer", limit=80, max_companies=100,
         include_wishlist=True, include_extra=True, include_yc=True, check_live=True):
    """
    Scan companies for matching jobs.
    Order: Wishlist (always) → portals.yml → extra companies → YC HN.
    Then: liveness check (drops expired) → dedupe → return.
    """
    kws = [k.strip().lower() for k in re.split(r"[\s,]+", keywords) if k.strip()]

    # Build company list: wishlist first, then portals.yml, then extras
    work = []
    seen_slugs = set()

    if include_wishlist:
        for w in WISHLIST:
            slug = w["slug"]
            if slug not in seen_slugs:
                work.append((w["name"], w["provider"], slug, w["region"]))
                seen_slugs.add(slug)

    for company, provider, slug, region in _load_companies():
        if slug not in seen_slugs:
            work.append((company, provider, slug, region))
            seen_slugs.add(slug)

    if include_extra:
        for company, provider, slug, region in EXTRA_COMPANIES:
            if slug not in seen_slugs:
                work.append((company, provider, slug, region))
                seen_slugs.add(slug)

    work = work[:max_companies]

    # Fetch all companies concurrently
    results = []
    with ThreadPoolExecutor(max_workers=14) as ex:
        futs = [ex.submit(_fetch_company, *c) for c in work]
        for f in as_completed(futs):
            try:
                for job in f.result():
                    title = job["title"].lower()
                    if not kws or any(re.search(r"\b" + re.escape(k) + r"\b", title) for k in kws):
                        results.append(job)
            except Exception:
                pass

    # Indeed/Google via jobspy + RemoteOK + YC + Workday: all get guaranteed slots (prepended)
    ro_yc = []

    # Workday
    wd_kw = " ".join(kws[:3]) if kws else "data analytics engineer"
    with ThreadPoolExecutor(max_workers=5) as ex:
        wd_futs = [ex.submit(_fetch_workday, name, tenant, sub, site, wd_kw)
                   for name, tenant, sub, site in WORKDAY_COMPANIES]
        for f in as_completed(wd_futs):
            for job in f.result():
                title = job["title"].lower()
                if not kws or any(k in title for k in kws):
                    ro_yc.append(job)

    for job in _fetch_jobspy(" ".join(kws) if kws else "data analytics engineer intern"):
        ro_yc.append(job)
    for job in _fetch_remoteok():
        # Match on title only — JD is too noisy for RemoteOK
        title = job["title"].lower()
        if not kws or any(k in title for k in kws):
            ro_yc.append(job)
    if include_yc:
        for job in _fetch_ycombinator_jobs():
            title = job["title"].lower()
            if not kws or any(re.search(r"\b" + re.escape(k) + r"\b", title) for k in kws):
                ro_yc.append(job)
    # Prepend so they survive the limit cap
    results = ro_yc + results

    # Dedupe by URL + cap per company (max 8 jobs per company to ensure diversity)
    seen_urls, deduped = set(), []
    per_company: dict = {}
    PER_COMPANY_MAX = 8
    for j in results:
        url = j.get("url", "")
        co = j.get("company", "").lower()
        if url and url in seen_urls:
            continue
        if per_company.get(co, 0) >= PER_COMPANY_MAX:
            continue
        seen_urls.add(url)
        per_company[co] = per_company.get(co, 0) + 1
        deduped.append(j)

    # Liveness check (sample top candidates to avoid slowness on full scan)
    if check_live and len(deduped) > 0:
        # Only check jobs from wishlist companies or first 30 (avoid slowing scan too much)
        wishlist_names = {w["name"].lower() for w in WISHLIST}
        to_check = [j for j in deduped if j.get("company", "").lower() in wishlist_names][:40]
        others = [j for j in deduped if j not in to_check]
        if to_check:
            with ThreadPoolExecutor(max_workers=10) as ex:
                live = list(ex.map(lambda j: (j, _check_liveness(j["url"])), to_check))
            live_jobs = [j for j, alive in live if alive]
            deduped = live_jobs + others

    return deduped[:limit]


if __name__ == "__main__":
    import sys
    kw = sys.argv[1] if len(sys.argv) > 1 else "data analytics intern"
    jobs = scan(kw)
    print(f"Found {len(jobs)} matching jobs:")
    for j in jobs[:40]:
        print(f"  [{j['platform']}] {j['company']} — {j['title']} ({j['location']})")
