#!/usr/bin/env python3
"""
scripts/bib2yml.py

Usage:
  python scripts/bib2yml.py <input.bib> <output.yml>

This script is a pragmatic BibTeX -> YAML converter tailored for
typical exports (Google Scholar / Zotero / BibTeX from LaTeX).
It purposely emits YAML using block scalars for text fields to avoid
YAML parse failures caused by backslashes, quotes, or special characters.
"""
from pathlib import Path
import re
import sys

# ---------- Parsing helpers ----------

def parse_bibtex_entries(text: str):
    """
    Minimal BibTeX parser that splits on entry starts and extracts fields
    in common formats. Not a full BibTeX parser but works for common exports.
    """
    entries = []
    # Normalize Windows newlines
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    parts = re.split(r'(?=@\w+\s*{)', text, flags=re.M)
    for p in parts:
        p = p.strip()
        if not p or not p.startswith("@"):
            continue
        m = re.match(r'@(\w+)\s*{\s*([^,]+)\s*,', p, flags=re.S)
        if not m:
            continue
        entry_type = m.group(1).lower()
        key = m.group(2).strip()
        body = p[m.end():].rsplit("}", 1)[0]

        fields = {}
        # This regex matches field = {value} OR field = "value" (with nested braces tolerated)
        for fm in re.finditer(r'\b([A-Za-z0-9_+-]+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,}]+)\s*,?', body, flags=re.S):
            k = fm.group(1).lower()
            v = fm.group(2).strip()
            # strip surrounding braces or quotes
            if v.startswith("{") and v.endswith("}"):
                v = v[1:-1]
            elif v.startswith('"') and v.endswith('"'):
                v = v[1:-1]
            v = v.strip()
            # collapse multiple whitespace
            v = re.sub(r'\s+', ' ', v).strip()
            fields[k] = v
        entries.append({"type": entry_type, "key": key, "fields": fields})
    return entries

def bib_author_to_text(authors: str) -> str:
    if not authors:
        return ""
    # Split on " and " which is BibTeX standard
    parts = [a.strip() for a in re.split(r'\s+and\s+', authors) if a.strip()]
    # Convert "Last, First" to "First Last" for nicer display if needed
    def normalize_name(n):
        if ',' in n:
            parts = [s.strip() for s in n.split(',', 1)]
            return f"{parts[1]} {parts[0]}" if parts[1] else parts[0]
        return n
    parts = [normalize_name(p) for p in parts]
    return ", ".join(parts)

def guess_links(fields: dict) -> dict:
    out = {"pdf": "", "doi": "", "code": ""}
    # DOI
    if "doi" in fields and fields["doi"]:
        doi = fields["doi"].strip()
        out["doi"] = doi if doi.startswith("http") else f"https://doi.org/{doi}"
    # url -> may be a direct PDF or landing page
    if "url" in fields and fields["url"]:
        url = fields["url"].strip()
        if url.lower().endswith(".pdf"):
            out["pdf"] = url
        else:
            # prefer DOI for landing pages; otherwise leave doi blank and maybe use url as pdf if it points to PDF
            pass
    # arXiv/eprint/pdf/file fields
    if "eprint" in fields and fields["eprint"]:
        e = fields["eprint"].strip()
        # common arXiv id forms
        if re.match(r'^\d{4}\.\d{4,5}', e) or 'arxiv' in e.lower():
            out["pdf"] = f"https://arxiv.org/pdf/{e}.pdf" if not e.lower().startswith('http') else e
    if "pdf" in fields and fields["pdf"]:
        out["pdf"] = fields["pdf"].strip()
    # code field (rare)
    if "code" in fields and fields["code"]:
        out["code"] = fields["code"].strip()
    return out

# ---------- YAML emission helpers ----------

def write_block(lines, key, text):
    """Write a YAML block scalar for 'key' with text content (literal |)."""
    if text is None:
        text = ""
    text = str(text).replace('\r\n', '\n').strip()
    lines.append(f"{key}: |")
    if text == "":
        # empty block (must still provide an indented blank line)
        lines.append("  ")
    else:
        for ln in text.split('\n'):
            lines.append("  " + ln)

def write_quoted(lines, key, text):
    """Write a short quoted YAML scalar, escaping internal quotes."""
    if text is None:
        text = ""
    s = str(text)
    s = s.replace('"', '\\"')
    lines.append(f'{key}: "{s}"')

# ---------- Main ----------

def main():
    if len(sys.argv) != 3:
        print("Usage: bib2yml.py <input.bib> <output.yml>")
        sys.exit(2)

    bib_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])

    if not bib_path.exists():
        print(f"Error: input file not found: {bib_path}")
        sys.exit(1)

    raw = bib_path.read_text(encoding="utf-8", errors="replace")
    entries = parse_bibtex_entries(raw)

    items = []
    for e in entries:
        f = e["fields"]
        title = f.get("title", "").strip()
        if not title:
            # skip entries without a title
            continue

        # Year extraction (prefer numeric)
        year_raw = f.get("year", "") or ""
        year_num = 0
        m_year = re.search(r'(\d{4})', str(year_raw))
        if m_year:
            try:
                year_num = int(m_year.group(1))
            except:
                year_num = 0

        authors = bib_author_to_text(f.get("author", ""))
        venue = f.get("journal") or f.get("booktitle") or f.get("publisher") or f.get("series") or ""
        ptype = e.get("type", "")

        links = guess_links(f)

        items.append({
            "title": title,
            "authors": authors,
            "venue": venue,
            "year": year_num,
            "type": ptype,
            "pdf": links.get("pdf","") or "",
            "doi": links.get("doi","") or "",
            "code": links.get("code","") or ""
        })

    # sort newest first
    items.sort(key=lambda x: x.get("year", 0) or 0, reverse=True)

    lines = []
    for it in items:
        lines.append("- title: |")
        if it.get("title"):
            for ln in str(it["title"]).splitlines():
                lines.append("  " + ln)
        else:
            lines.append("  ")

        lines.append("  authors: |")
        if it.get("authors"):
            for ln in str(it["authors"]).splitlines():
                lines.append("  " + ln)
        else:
            lines.append("  ")

        lines.append("  venue: |")
        if it.get("venue"):
            for ln in str(it["venue"]).splitlines():
                lines.append("  " + ln)
        else:
            lines.append("  ")

        # year as integer (plain scalar)
        y = it.get("year", 0) or 0
        try:
            y = int(y)
        except Exception:
            y = 0
        lines.append(f"  year: {y}")

        # type (plain scalar, small)
        t = str(it.get("type","") or "").strip()
        lines.append(f"  type: {t}")

        # short quoted fields for URLs (escape internal quotes)
        write_quoted(lines, "  pdf", it.get("pdf","") or "")
        write_quoted(lines, "  doi", it.get("doi","") or "")
        write_quoted(lines, "  code", it.get("code","") or "")

        lines.append("")  # blank line between records

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote {out_path} with {len(items)} entries.")

if __name__ == "__main__":
    main()
