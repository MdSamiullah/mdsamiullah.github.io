import sys
import time
from pathlib import Path

import requests
import yaml
from bs4 import BeautifulSoup

PROFILE_URL = "https://scholar.google.com/citations"
OUT_PATH = Path("_data/citations.yml")
DEBUG_HTML = Path("generated/scholar_debug.html")

REQUEST_TIMEOUT = 15
RETRIES = 2
SLEEP_BETWEEN = 2

HEADERS = {
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
            print("HTTP:", r.status_code, "Final URL:", r.url)
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
    title = soup.title.get_text(strip=True) if soup.title else "(no title)"
    print("Page title:", title)

    years = [x.get_text(strip=True) for x in soup.select("span.gsc_g_t")]
    counts = [x.get_text(strip=True) for x in soup.select("a.gsc_g_al")]

    if not years or not counts or len(years) != len(counts):
        txt = soup.get_text(" ", strip=True).lower()
        if "unusual traffic" in txt or "not a robot" in txt or "captcha" in txt:
            raise RuntimeError("Blocked by Google Scholar (captcha/unusual traffic).")
        if "consent" in txt and "google" in txt:
            raise RuntimeError("Got a Google consent page (cannot parse Scholar profile).")
        raise RuntimeError("Citations-per-year elements not found on fetched page.")

    data = []
    for y, c in zip(years, counts):
        try:
            data.append({"year": int(y), "count": int(c.replace(",", ""))})
        except Exception:
            pass

    data.sort(key=lambda r: r["year"], reverse=True)
    return data

def main():
    if len(sys.argv) < 2:
        print("Usage: fetch_scholar_citations.py SCHOLAR_ID")
        return 1

    scholar_id = sys.argv[1]
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEBUG_HTML.parent.mkdir(parents=True, exist_ok=True)

    try:
        html = fetch_html(scholar_id)
        # Save what we fetched for inspection
        DEBUG_HTML.write_text(html, encoding="utf-8", errors="replace")
        print(f"Saved debug HTML to {DEBUG_HTML}")

        data = parse_citations_per_year(html)

        # Only overwrite if we actually got data
        if not data:
            raise RuntimeError("Parsed citations list is empty after extraction.")

        OUT_PATH.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
        print(f"Updated {OUT_PATH} with {len(data)} years.")
        return 0

    except Exception as e:
        print("WARNING: Could not update citations from Scholar.")
        print("Reason:", repr(e))
        print("Keeping existing citations.yml (if present).")
        # Do NOT overwrite existing citations.yml with []
        if not OUT_PATH.exists():
            OUT_PATH.write_text(yaml.safe_dump([], sort_keys=False), encoding="utf-8")
        return 0  # don't break your Pages build

if __name__ == "__main__":
    sys.exit(main())
