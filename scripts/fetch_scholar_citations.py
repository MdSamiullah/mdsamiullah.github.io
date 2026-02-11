# scripts/fetch_scholar_citations.py
import sys
import time
from pathlib import Path

import requests
import yaml
from bs4 import BeautifulSoup

PROFILE_URL = "https://scholar.google.com/citations"
OUT_PATH = Path("_data/citations.yml")

# Hard limits so Actions never hangs
REQUEST_TIMEOUT = 15  # seconds
RETRIES = 2           # total attempts = 1 + RETRIES
SLEEP_BETWEEN = 2     # seconds

HEADERS = {
    # A normal browser UA reduces blocks (not a guarantee)
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

def fetch_html(scholar_id: str) -> str:
    params = {"user": scholar_id, "hl": "en"}
    last_err = None
    for attempt in range(RETRIES + 1):
        try:
            r = requests.get(PROFILE_URL, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")
            return r.text
        except Exception as e:
            last_err = e
            if attempt < RETRIES:
                time.sleep(SLEEP_BETWEEN)
    raise last_err

def parse_citations_per_year(html: str):
    soup = BeautifulSoup(html, "html.parser")

    # Scholar profile page usually contains bars:
    # year in span.gsc_g_t, count in a.gsc_g_al
    years = [x.get_text(strip=True) for x in soup.select("span.gsc_g_t")]
    counts = [x.get_text(strip=True) for x in soup.select("a.gsc_g_al")]

    # If blocked, Scholar often serves a CAPTCHA/consent page with none of these.
    if not years or not counts or len(years) != len(counts):
        # Common signals of being blocked:
        txt = soup.get_text(" ", strip=True).lower()
        if "not a robot" in txt or "captcha" in txt or "unusual traffic" in txt:
            raise RuntimeError("Blocked by Google Scholar (captcha/unusual traffic).")
        raise RuntimeError("Could not find citations-per-year elements on the page.")

    data = []
    for y, c in zip(years, counts):
        try:
            yy = int(y)
            cc = int(c.replace(",", ""))
            data.append({"year": yy, "count": cc})
        except Exception:
            continue

    # newest first
    data.sort(key=lambda r: r["year"], reverse=True)
    return data

def main():
    if len(sys.argv) < 2:
        print("Usage: fetch_scholar_citations.py SCHOLAR_ID")
        return 1

    scholar_id = sys.argv[1]
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    try:
        html = fetch_html(scholar_id)
        data = parse_citations_per_year(html)

        OUT_PATH.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
        print(f"Updated {OUT_PATH} with {len(data)} years.")
        return 0

    except Exception as e:
        # IMPORTANT: Do not fail the build. Keep last known data.
        print("WARNING: Could not update citations from Scholar.")
        print("Reason:", repr(e))

        if OUT_PATH.exists():
            print(f"Keeping existing {OUT_PATH}.")
        else:
            print(f"{OUT_PATH} missing; writing empty list placeholder.")
            OUT_PATH.write_text(yaml.safe_dump([], sort_keys=False), encoding="utf-8")

        return 0  # success (prevents your Pages build from breaking)

if __name__ == "__main__":
    sys.exit(main())
