# scripts/fetch_scholar_citations.py
import sys
import yaml
import time
from scholarly import scholarly

# ---- CONFIG ----
TIMEOUT_SECONDS = 60   # hard stop
# ----------------

def main():
    if len(sys.argv) < 2:
        print("Usage: fetch_scholar_citations.py SCHOLAR_ID")
        sys.exit(1)

    scholar_id = sys.argv[1]

    # IMPORTANT: disable proxies to avoid infinite waits
    scholarly.use_proxy(None)

    start = time.time()
    try:
        author = scholarly.search_author_id(scholar_id)
        if time.time() - start > TIMEOUT_SECONDS:
            raise TimeoutError("Scholar lookup timeout")

        author = scholarly.fill(author, sections=["counts"])
        if time.time() - start > TIMEOUT_SECONDS:
            raise TimeoutError("Scholar fill timeout")

    except Exception as e:
        print("ERROR: Failed to fetch Scholar data:", e)
        sys.exit(2)

    cites = author.get("cites_per_year", {})
    if not cites:
        print("WARNING: No citation data returned")
        sys.exit(3)

    data = [
        {"year": int(y), "count": int(c)}
        for y, c in sorted(cites.items(), reverse=True)
    ]

    with open("_data/citations.yml", "w") as f:
        yaml.safe_dump(data, f, sort_keys=False)

    print("Updated citations.yml successfully")

if __name__ == "__main__":
    main()
