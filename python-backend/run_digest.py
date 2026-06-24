#!/usr/bin/env python3
"""Standalone runner: scan + grade A/B + post curated digest to Discord.
Used by the 8am scheduled task. No server needed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import app

if __name__ == "__main__":
    app.init_db()
    res = app.daily_digest(notify=True)
    print("Digest:", {k: res.get(k) for k in ("a", "b", "added")})
