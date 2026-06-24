"""
AI CV tailoring — replicates the manual high-score method automatically.

Method encoded here (same steps used to take Tesla 29%->97% by hand):
  1. Caller runs ATS first and passes the exact missing keywords.
  2. The model rewrites REAL experience to surface those keywords naturally,
     using exact word forms (summarize != summarized).
  3. It must PRESERVE keywords already present (never drop them).
  4. It adds a short "Why <company>" line to legitimately carry product/brand
     keywords as genuine interest (not as claimed experience).
  5. Caller iterates: re-score, re-feed remaining gaps for a 2nd pass.
  6. Truthful: never invents employers, titles, dates, degrees, or metrics.
"""
import json
import os
from pathlib import Path
import urllib.request

CAREER_OPS = Path("/Users/andrea_star/Desktop/Applications/career-ops")


def _api_key():
    env = CAREER_OPS / "config" / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line.startswith("OPENAI_API_KEY") and "=" in line:
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get("OPENAI_API_KEY", "")


SYSTEM = """You are an expert ATS resume optimizer. You rewrite a candidate's REAL
experience so it naturally surfaces the exact skills/keywords a job description asks
for, while staying truthful and readable for human reviewers.

HARD RULES (truthfulness):
- NEVER invent or alter: employers, job titles, dates, schools, degrees, or numbers/metrics.
- Only claim skills/tools plausibly supported by the candidate's real background.

OPTIMIZATION RULES:
- You are given a list of MISSING KEYWORDS the CV currently fails to match. Work them
  into the bullets and skills using their EXACT form (if the list says "summarize",
  write "summarize", not "summarized"). Prioritize the higher-frequency ones.
- PRESERVE every skill/tool already in the CV — never remove an existing keyword.
- Do NOT produce a pasted keyword list. Integrate keywords into real sentences.
- For company names, product names, or locations from the JD, do NOT claim them as
  experience. Instead you MAY add ONE final line "**Why {company}:** ..." expressing
  genuine interest that naturally mentions those product/brand terms.

FORMAT RULES:
- Keep the EXACT markdown structure of the input CV: same headings (## ...), same
  companies, same bullet marker (●), same skill-row labels (**Label:** ...).
- One page. Same length or slightly shorter.
- Output ONLY the full tailored CV markdown. No commentary, no code fences."""


def tailor_cv(jd, base_cv_md, company="", role="", missing_keywords=None, prev_cv_md=None):
    """Tailor a CV. If prev_cv_md is given, refine IT (2nd pass) targeting remaining gaps."""
    key = _api_key()
    if not key:
        return base_cv_md
    missing_keywords = missing_keywords or []
    kw_line = ", ".join(missing_keywords[:60]) if missing_keywords else "(none provided)"
    cv_to_edit = prev_cv_md or base_cv_md
    pass_note = ("This is a REFINEMENT pass. The CV below is already tailored; only add the "
                 "still-missing keywords below without removing anything.") if prev_cv_md else ""

    user = f"""TARGET ROLE: {role} at {company}

JOB DESCRIPTION:
{jd[:6000]}

MISSING KEYWORDS to work in (exact forms, higher-frequency first):
{kw_line}

{pass_note}

CV TO TAILOR (keep this exact structure):
{cv_to_edit}

Return the full tailored CV markdown only."""

    body = json.dumps({
        "model": "gpt-4o",
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": user}],
        "temperature": 0.25,
        "max_tokens": 3000,
    }).encode()
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
        data=body, headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            d = json.load(r)
        out = d["choices"][0]["message"]["content"].strip()
        if out.startswith("```"):
            out = out.split("\n", 1)[1].rsplit("```", 1)[0]
        return out.strip()
    except Exception:
        return cv_to_edit


if __name__ == "__main__":
    import sys
    jd = Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else "Data Engineer: SQL, Python, Spark, ETL, dbt, Snowflake."
    base = (CAREER_OPS / "cv.md").read_text()
    print(tailor_cv(jd, base, "TestCo", "Data Engineer", ["spark", "dbt", "snowflake", "etl"])[:1000])
