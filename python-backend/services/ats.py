"""
ATS keyword checker — pure Python port of ats-check.mjs
No API key needed, runs in <100ms
"""
import re
from typing import Dict, List, Tuple

# Words to always ignore (stopwords + job boilerplate)
STOPWORDS = {
    "the","and","for","with","this","that","have","from","are","will",
    "you","your","our","their","they","been","has","was","were","can",
    "not","but","all","any","its","who","how","what","when","where",
    "which","would","could","should","more","some","than","such","into",
    "also","each","just","over","both","under","other","while","about",
    "after","before","these","those","then","well","even","most","many",
    "very","only","back","good","year","come","work","may","use","used",
    "using","new","need","know","make","able","find","long","see","way",
    "him","her","she","him","his","one","out","day","get","put","set",
    "per","via","inc","llc","ltd","co","etc","a","an","in","is","of",
    "to","be","we","as","or","at","if","do","on","by","it","up","us",
    "no","go","so","my","me","he","am","had","him","his","how","its",
    "own","say","too","via","yet","ago","aim","bid","bit","buy","due",
    "fit","got","job","key","law","led","let","lot","low","map","mix",
    "net","now","old","pay","ran","run","sat","saw","six","ten","top",
    "try","two","war","way","win","won","yes","yet","you","zero","five",
    "four","nine","eight","seven","three","come","goes","went","does",
    "done","made","make","take","took","look","like","give","gave","live",
    "move","show","part","play","plan","real","role","side","stay","step",
    "stop","sure","tell","them","then","time","turn","type","want","well",
    "whom","wide","wish","with","word","year","note","plus","help","team",
    "here","high","join","lead","next","open","same","self","text","true",
    "unit","view","area","base","case","data","days","each","else","end",
    "fact","form","full","give","goal","grow","hand","hard","head","hold",
    "home","hope","idea","keep","kind","lack","last","left","less","list",
    "meet","mind","miss","more","move","must","name","near","nice","note",
    "once","only","open","oral","past","pick","plan","play","plus","post",
    "push","rate","read","rest","rise","risk","rule","seek","sell","send",
    "sign","size","soon","sort","span","star","task","term","test","than",
    "they","this","thus","till","upon","used","user","vary","very","wait",
    "walk","week","well","went","were","what","when","whom","will","wish",
    "with","work","year","your","able","add","age","ago","aim","air",
}

def normalize(text: str) -> List[str]:
    """Lowercase, remove punctuation, split into words/bigrams."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s\-/]', ' ', text)
    words = [w.strip('-/') for w in text.split() if w.strip('-/')]
    return [w for w in words if len(w) > 2 and w not in STOPWORDS]

def extract_keywords(jd: str) -> Dict[str, int]:
    """Extract keywords with frequency from job description."""
    words = normalize(jd)
    freq: Dict[str, int] = {}

    # Single words
    for w in words:
        if len(w) >= 3:
            freq[w] = freq.get(w, 0) + 1

    # Bigrams (common tech phrases)
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        if len(bigram) > 6:
            freq[bigram] = freq.get(bigram, 0) + 1

    # Remove very common single-char leftovers
    return {k: v for k, v in freq.items() if v >= 1 and len(k) > 2}

def check_ats(jd: str, cv: str) -> Dict:
    """
    Returns:
      score: float 0-100
      matched: list of matched keywords
      missing: list of (keyword, freq) sorted by freq desc
      total: int
    """
    jd_keywords = extract_keywords(jd)
    cv_lower = cv.lower()
    cv_lower = re.sub(r'[^a-z0-9\s\-/]', ' ', cv_lower)

    matched = []
    missing = []

    for keyword, freq in jd_keywords.items():
        # Check if keyword appears in CV
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, cv_lower):
            matched.append(keyword)
        else:
            missing.append((keyword, freq))

    total = len(jd_keywords)
    score = round(len(matched) / total * 100, 1) if total > 0 else 0

    # Sort missing by frequency desc
    missing.sort(key=lambda x: x[1], reverse=True)

    return {
        "score": score,
        "matched": matched,
        "missing": [{"keyword": k, "freq": f} for k, f in missing],
        "matched_count": len(matched),
        "total": total,
    }

def suggest_additions(missing: List[Dict]) -> List[str]:
    """Return top fixable keywords to add to CV."""
    # Filter out obvious non-CV words
    skip = {"location","irvine","california","remote","required","around","even",
            "benefits","direct","suite","offer","equal","opportunity","employer",
            "applicants","considered","regardless","race","color","religion","sex",
            "national","origin","disability","veteran","status","apply","now",
            "click","here","submit","application","careers","jobs","posting"}
    return [m["keyword"] for m in missing if m["keyword"] not in skip][:20]
