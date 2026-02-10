# scripts/fetch_scholar_citations.py
import sys
import time
import yaml
from scholarly import scholarly

TIMEOUT_SECONDS = 60  # hard stop

def main():
    if len(sys.argv) < 2:
        print("Usage: fetch_scholar_citations.py SCHOLAR_ID")
        sys.exit(1)

    scholar_id = sys.argv[1]

    start = time.time()

    try:
        # Fetch author by ID
        author = scholarly.search_author_id(scholar_id)

        if time.time() - start > TIMEOUT_SECONDS:
            raise TimeoutError("Timeout while searching author")

        # Only fetch citation counts (fastest & safest)
        author = scholarly.fill(author, sections=["counts"])

        if time.time() - start > TIMEOUT_SECONDS:
            raise TimeoutError("Timeout while filling citation counts")

    except Exception as e:
        print("ERROR: Google Scholar fetch failed")
        print(e)
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
