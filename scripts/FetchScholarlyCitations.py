#!/usr/bin/env python3
"""
Fetch citations per year from Google Scholar using scholarly and write to:
  _data/citations.yml

Output format (YAML list):
- year: 2025
  count: 31
- year: 2024
  count: 27
...

Usage:
  python scripts/fetch_scholar_citations.py TvgYhREAAAAJ
"""

import os
import sys
import time
import threading
from pathlib import Path

import yaml
from scholarly import scholarly


# Hard stop so this can NEVER hang forever in GitHub Actions
HARD_TIMEOUT_SECONDS = 90

OUT_PATH = Path("_data/citations.yml")


def hard_kill_after(seconds: int):
    """Force-exit the process after `seconds` no matter what (watchdog)."""
    def killer():
        time.sleep(seconds)
        print(f"\nERROR: Hard timeout reached ({seconds}s). Exiting.", flush=True)
        os._exit(124)  # immediate exit, bypassing stuck network calls

    t = threading.Thread(target=killer, daemon=True)
    t.start()


def main():
    if len(sys.argv) < 2:
        print("Usage: fetch_scholar_citations.py SCHOLAR_ID", file=sys.stderr)
        return 2

    scholar_id = sys.argv[1].strip()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # start watchdog
    hard_kill_after(HARD_TIMEOUT_SECONDS)

    try:
        print(f"Fetching Scholar profile counts for user={scholar_id} ...", flush=True)

        # 1) basic author object
        author = scholarly.search_author_id(scholar_id)

        # 2) fill ONLY counts (fast + enough for cites_per_year)
        # Avoid scholarly.fill(author) without sections, because it pulls publications and can hang.
        author_full = scholarly.fill(author, sections=["counts", "basics", "indices"])

        cites_per_year = author_full.get("cites_per_year", {}) or {}

        if not cites_per_year:
            raise RuntimeError("No cites_per_year returned (blocked, wrong ID, or empty profile).")

        # convert to expected YAML list format
        data = []
        for y, c in cites_per_year.items():
            try:
                data.append({"year": int(y), "count": int(c)})
            except Exception:
                continue

        data.sort(key=lambda r: r["year"], reverse=True)

        OUT_PATH.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
        print(f"OK: wrote {OUT_PATH} ({len(data)} years).", flush=True)

        # Optional: print quick summary
        name = author_full.get("name", "")
        citedby = author_full.get("citedby", author_full.get("citedby", 0))
        hindex = author_full.get("hindex", 0)
        i10 = author_full.get("i10index", 0)
        if name:
            print(f"Author: {name} | citations={citedby} | hindex={hindex} | i10={i10}", flush=True)

        return 0

    except Exception as e:
        # IMPORTANT: do not overwrite good cached data with empty YAML
        print("ERROR: Google Scholar fetch failed:", repr(e), flush=True)
        if OUT_PATH.exists():
            print(f"Keeping existing {OUT_PATH}.", flush=True)
            return 0  # keep site working
        else:
            print(f"{OUT_PATH} missing; writing empty list placeholder.", flush=True)
            OUT_PATH.write_text(yaml.safe_dump([], sort_keys=False), encoding="utf-8")
            return 0


if __name__ == "__main__":
    sys.exit(main())
