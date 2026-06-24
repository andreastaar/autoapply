#!/usr/bin/env node
/**
 * ATS Keyword Checker
 * Usage:
 *   node ats-check.mjs "jd text"
 *   node ats-check.mjs jds/apple.txt
 *   node ats-check.mjs "jd text" --cv /tmp/cv-apple.html
 *   cat jd.txt | node ats-check.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── STOP WORDS (expanded) ───────────────────────────────────────────────────
const STOP = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "from","as","is","was","are","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","must","can",
  "that","this","these","those","it","its","their","they","we","you","your",
  "our","all","any","both","each","few","more","most","other","some","such",
  "no","not","only","own","same","so","than","too","very","just","also","well",
  "about","above","after","before","between","during","through","within","without",
  "while","where","when","who","what","which","how","if","then","there","here",
  "i","my","me","he","she","him","her","his","hers","us","them",
  "new","get","use","used","using","make","made","work","working","need","take",
  "give","help","want","include","including","able","allow","ensure","provide",
  "related","relevant","specific","general","various","multiple","different",
  "based","per","up","out","into","over","under","upon","across","without",
  // Generic JD words that aren't real skills
  "areas","experiences","experience","develop","developing","development",
  "practical","qualifications","proficiency","conducting","computer",
  "internship","collaborate","crafting","build","building","apply","applying",
  "explore","exploring","impact","impacts","impacting","understand","understanding",
  "day","ways","world","field","fields","industry","team","teams","partner",
  "opportunity","opportunities","end","form","gain","deliver","delivering",
  "present","presenting","meet","implement","implementing","design","designing",
  "learn","learning","learning","thing","things","part","play","plays","daily",
  "life","ongoing","revolution","integrated","hardware","software","unique",
  "amazing","meaningful","together","valuable","connections","guidance",
  "allow","allows","greater","play","plays","tackling","tackle","receive",
  "pursue","pursuing","real","practical","greater","excellent","minimum",
  "preferred","ability","ability","familiarity","expertise","knowledge",
  "minimum","preferred","pursuit","obtain","area","every","least","one",
  "such","interpret","interpreting","analyze","analyzing","conduct","adapt",
  "adapting","adapt","addition","additionally","including","relate",
  "relate","program","programs","project","projects","manager","managers",
  "engineer","engineers","researcher","researchers","intern","interns",
  "mentorship","mentoring","mentor","guidance","technical","technology",
  "technologies","innovative","innovation","challenge","challenges",
  "challenging","solution","solutions","solve","solving","problem","problems",
  "protocol","protocols","theory","theories","method","methods","approach",
  "collaborate","collaboration","collaborating","collaborator",
  "new","metric","metrics","exist","existing",
]);

// ─── MEANINGFUL MULTI-WORD PHRASES ───────────────────────────────────────────
const PHRASES = [
  // ML / AI
  "machine learning","deep learning","reinforcement learning","large language models",
  "diffusion models","neural networks","natural language processing","computer vision",
  "multimodal","multimodal ml","multimodal machine learning","multimodal sensing",
  "generative ai","foundation models","llm","llms","language model","language models",
  "transfer learning","fine-tuning","fine tuning","prompt engineering",
  "retrieval augmented generation","rag","rag pipeline","llm agent","llm agents",
  "model evaluation","model training","model deployment","model inference",
  "feature engineering","feature selection","ablation study",
  "supervised learning","unsupervised learning","self-supervised",
  "convolutional neural","recurrent neural","attention mechanism","transformer",
  "gpt","bert","llama","stable diffusion","vae","gan",
  // Libraries & Frameworks
  "pytorch","tensorflow","scikit-learn","sklearn","xgboost","lightgbm",
  "hugging face","langchain","openai","faiss","chromadb","pinecone",
  "pandas","numpy","scipy","matplotlib","seaborn","plotly",
  "fastapi","flask","streamlit","gradio","django",
  "docker","kubernetes","airflow","mlflow","wandb","dvc",
  "spark","kafka","hadoop","dbt","airflow",
  // Languages
  "python","sql","java","javascript","typescript","c++","c/c++","ruby","bash",
  "swift","objective c","objective-c","scala","r language",
  // Cloud & Infra
  "aws","azure","google cloud","gcp","sagemaker","vertex ai","databricks",
  "microsoft fabric","power bi","tableau","looker",
  // Data Engineering
  "etl pipeline","data pipeline","data engineering","data science",
  "data mining","data modeling","data warehouse","feature store",
  // Math / Stats
  "linear algebra","time series","causal inference","stochastic modeling",
  "operations research","optimization theory","decision theory",
  "statistical modeling","statistical analysis","bayesian","econometrics",
  "probability theory","hypothesis testing","a/b testing",
  // Soft / Role skills
  "object-oriented programming","object oriented","problem solving","problem-solving",
  "cross-functional","state-of-the-art","interactive systems","human interaction",
  "experiments and investigations","privacy preserving","privacy-preserving",
  // Apple-specific
  "coreflow","core ml","coreml","create ml","apple silicon","on-device",
  // Certifications
  "microsoft certified","aws certified","google certified","lean six sigma",
  // Domains
  "supply chain","supply chain analytics","demand forecasting","logistics",
  "natural language","speech recognition","image recognition","recommendation system",
  "fraud detection","anomaly detection","predictive modeling","classification",
  "regression","clustering","dimensionality reduction","rag system",
];

// ─── LOAD CV ──────────────────────────────────────────────────────────────────
function loadCV() {
  // Check for --cv flag
  const cvIdx = process.argv.indexOf("--cv");
  if (cvIdx !== -1 && process.argv[cvIdx + 1]) {
    const p = process.argv[cvIdx + 1];
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf8");
      // Strip HTML tags if HTML file
      return raw.replace(/<[^>]+>/g, " ").toLowerCase();
    }
  }
  // Default: cv.md
  const cvPath = join(__dir, "cv.md");
  if (!existsSync(cvPath)) { console.error("cv.md not found"); process.exit(1); }
  return readFileSync(cvPath, "utf8").toLowerCase();
}

// ─── LOAD JD ──────────────────────────────────────────────────────────────────
function loadJD() {
  // Find first non-flag argument
  const args = process.argv.slice(2).filter((a, i, arr) => {
    if (a === "--cv") return false;
    if (i > 0 && arr[i-1] === "--cv") return false;
    return true;
  });
  const arg = args[0];
  if (!arg) {
    try { return readFileSync("/dev/stdin", "utf8"); } catch {}
    console.error("Usage: node ats-check.mjs \"jd text\" [--cv /path/to/cv.html]");
    process.exit(1);
  }
  if (existsSync(arg)) return readFileSync(arg, "utf8");
  return arg;
}

// ─── EXTRACT KEYWORDS FROM JD ────────────────────────────────────────────────
function extractKeywords(text) {
  const lower = text.toLowerCase();
  const found = new Map();

  // Multi-word phrases first
  for (const phrase of PHRASES) {
    const escaped = phrase.replace(/[+#.()/]/g, "\\$&").replace(/-/g, "[- ]?");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches) found.set(phrase, matches.length);
  }

  // Single words — only keep if NOT already covered by a phrase match
  const words = lower.match(/\b[a-z][a-z0-9+#]{2,}\b/g) || [];
  for (const w of words) {
    if (STOP.has(w)) continue;
    if (/^\d+$/.test(w)) continue;
    if (w.length < 4) continue;
    const coveredByPhrase = [...found.keys()].some(p => {
      const parts = p.split(" ");
      return parts.length > 1 && parts.includes(w);
    });
    if (coveredByPhrase) continue;
    found.set(w, (found.get(w) || 0) + 1);
  }

  return [...found.entries()].sort((a, b) => b[1] - a[1]);
}

// ─── CHECK AGAINST CV ────────────────────────────────────────────────────────
function checkCV(cvText, jdKeywords) {
  const present = [], missing = [];
  for (const [kw, count] of jdKeywords) {
    const escaped = kw.replace(/[+#.()/]/g, "\\$&").replace(/-/g, "[- ]?");
    const regex = new RegExp(`\\b${escaped}`, "i");
    (regex.test(cvText) ? present : missing).push([kw, count]);
  }
  return { present, missing };
}

// JSON output: full missing list, no truncation
const cv = loadCV();
const jd = loadJD();
const keywords = extractKeywords(jd);
const { present, missing } = checkCV(cv, keywords);
const total = present.length + missing.length;
const pct = total ? Math.round(present.length / total * 100) : 0;
console.log(JSON.stringify({
  score: pct,
  matched_count: present.length,
  total,
  missing: missing.map(([keyword, freq]) => ({ keyword, freq })),
  present: present.map(([keyword]) => keyword),
}));
