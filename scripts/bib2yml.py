#!/usr/bin/env python3
"""
Safe BibTeX -> _data/publications.yml generator (drop-in).
Produces YAML using block scalars with strict indentation:
- list item marker at column 0: "- title: |"
- title content lines indented 4 spaces
- sibling keys (authors, venue, year, ...) indented 2 spaces
- sibling multi-line values indented 4 spaces
"""

from pathlib import Path
import re
import sys

def parse_bibtex_entries(text: str):
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    parts = re.split(r'(?=@\w+\s*{)', text, flags=re.M)
    entries = []
    for p in parts:
        p = p.strip()
        if not p or not p.startswith("@"):
            continue
        m = re.match(r'@(\w+)\s*{\s*([^,]+)\s*,', p, flags=re.S)
        if not m:
            continue
        etype = m.group(1).lower()
        key = m.group(2).strip()
        body = p[m.end():].rsplit("}", 1)[0]
        fields = {}
        # field = {value} OR "value" OR bare (until comma or })
        for fm in re.finditer(r'\b([A-Za-z0-9_+-]+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,}]+)\s*,?', body, flags=re.S):
            k = fm.group(1).lower()
            v = fm.group(2).strip()
            if v.startswith("{") and v.endswith("}"):
                v = v[1:-1]
            elif v.startswith('"') and v.endswith('"'):
                v = v[1:-1]
            v = re.sub(r'\s+', ' ', v).strip()
            fields[k] = v
        entries.append({"type": etype, "key": key, "fields": fields})
    return entries

def authors_to_text(authors: str) -> str:
    if not authors:
        return ""
    parts = [a.strip() for a in re.split(r'\s+and\s+', authors) if a.strip()]
    def normalize(n):
        if ',' in n:
            p = [s.strip() for s in n.split(',',1)]
            return f"{p[1]} {p[0]}" if p[1] else p[0]
        return n
    return ", ".join([normalize(p) for p in parts])

def guess_links(fields: dict) -> dict:
    out = {"pdf":"", "doi":"", "code":""}
    if "doi" in fields and fields["doi"]:
        d = fields["doi"].strip()
        out["doi"] = d if d.startswith("http") else f"https://doi.org/{d}"
    if "url" in fields and fields["url"]:
        u = fields["url"].strip()
        if u.lower().endswith(".pdf"):
            out["pdf"] = u
    if "eprint" in fields and fields["eprint"]:
        e = fields["eprint"].strip()
        if re.search(r'\d{4}\.\d{4,5}', e) or 'arxiv' in e.lower():
            # normalize arXiv id or url
            if e.startswith('http'):
                out["pdf"] = e
            else:
                out["pdf"] = f"https://arxiv.org/pdf/{e}.pdf"
    if "pdf" in fields and fields["pdf"]:
        out["pdf"] = fields["pdf"].strip()
    if "code" in fields and fields["code"]:
        out["code"] = fields["code"].strip()
    return out

def write_block(lines, key, text):
    """Write a YAML block scalar where key is indented 2 spaces, content lines 4 spaces."""
    # key is emitted as: "  key: |"
    lines.append(f"  {key}: |")
    if text is None:
        text = ""
    text = str(text).replace('\r\n','\n').strip()
    if text == "":
        lines.append("    ")
    else:
        for ln in text.split("\n"):
            lines.append("    " + ln)

def write_quoted(lines, key, text):
    # key emitted as two-space indented short quoted scalar
    if text is None:
        text = ""
    s = str(text)
    s = s.replace('"', '\\"')
    lines.append(f'  {key}: "{s}"')

def main():
    if len(sys.argv) != 3:
        print("Usage: bib2yml.py <input.bib> <output.yml>")
        sys.exit(2)

    bib_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])

    if not bib_path.exists():
        print(f"Input .bib not found: {bib_path}")
        sys.exit(1)

    raw = bib_path.read_text(encoding="utf-8", errors="replace")
    entries = parse_bibtex_entries(raw)

    items = []
    for e in entries:
        f = e["fields"]
        title = f.get("title","").strip()
        if not title:
            continue
        year_raw = f.get("year","") or ""
        year_num = 0
        m = re.search(r'(\d{4})', str(year_raw))
        if m:
            try:
                year_num = int(m.group(1))
            except:
                year_num = 0
        authors = authors_to_text(f.get("author",""))
        venue = f.get("journal") or f.get("booktitle") or f.get("publisher") or f.get("series") or ""
        ptype = e.get("type","")
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

    items.sort(key=lambda x: x.get("year",0) or 0, reverse=True)

    lines = []
    for it in items:
        # list item marker at col 0
        lines.append("- title: |")
        # title content: indent 4 spaces
        if it.get("title"):
            for ln in str(it["title"]).splitlines():
                lines.append("    " + ln)
        else:
            lines.append("    ")

        # sibling keys indented 2 spaces and values using block scalars or quoted
        write_block(lines, "authors", it.get("authors",""))
        write_block(lines, "venue", it.get("venue",""))

        # year as plain integer (2-space indent)
        y = it.get("year",0) or 0
        try:
            y = int(y)
        except:
            y = 0
        lines.append(f"  year: {y}")

        # type as plain scalar
        t = str(it.get("type","") or "").strip()
        lines.append(f"  type: {t}")

        # pdf/doi/code as quoted short scalars (2-space indent)
        write_quoted(lines, "pdf", it.get("pdf","") or "")
        write_quoted(lines, "doi", it.get("doi","") or "")
        write_quoted(lines, "code", it.get("code","") or "")

        lines.append("")  # blank line between records

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote {out_path} with {len(items)} entries.")

if __name__ == "__main__":
    main()
