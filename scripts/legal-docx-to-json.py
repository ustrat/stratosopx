"""Convert the StratosOpX legal .docx drafts into JSON content for the site.

The Word files stay out of git (see .gitignore); only the generated JSON is
committed. Re-run after counsel sends a revision:

    python -I scripts/legal-docx-to-json.py

Requires python-docx.
"""

import json
import pathlib
import sys

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content" / "legal"

SOURCES = {
    "terms": "StratosOpX Terms of Service.docx",
    "privacy": "StratosOpX Privacy Policy.docx",
    "accessibility": "StratosOpX Accessibility Statement.docx",
}


def segments(p: Paragraph):
    """Runs merged into [{text, bold}] segments."""
    segs = []
    for run in p.runs:
        if not run.text:
            continue
        bold = bool(run.bold)
        if segs and segs[-1]["bold"] == bold:
            segs[-1]["text"] += run.text
        else:
            segs.append({"text": run.text, "bold": bold})
    # trim outer whitespace
    if segs:
        segs[0]["text"] = segs[0]["text"].lstrip()
        segs[-1]["text"] = segs[-1]["text"].rstrip()
    return [s for s in segs if s["text"]]


def body_items(document):
    for child in document.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            yield Paragraph(child, document)
        elif tag == "tbl":
            yield Table(child, document)


def convert(path: pathlib.Path):
    d = docx.Document(str(path))
    title = None
    blocks = []
    preamble = []

    for item in body_items(d):
        if isinstance(item, Table):
            rows = [[c.text.strip() for c in r.cells] for r in item.rows]
            blocks.append({"type": "table", "header": rows[0], "rows": rows[1:]})
            continue

        text = item.text.strip()
        if not text:
            continue
        style = item.style.name
        segs = segments(item)

        if style == "Heading 1":
            title = text
        elif style.startswith("Heading"):
            blocks.append({"type": "heading", "text": text})
        elif style == "List Paragraph":
            if blocks and blocks[-1]["type"] == "list":
                blocks[-1]["items"].append(segs)
            else:
                blocks.append({"type": "list", "items": [segs]})
        elif not any(b["type"] == "heading" for b in blocks):
            # Lines before the first section heading: date line and draft notice.
            preamble.append(text)
        elif segs and all(s["bold"] for s in segs) and len(text) < 60:
            blocks.append({"type": "subheading", "text": text})
        else:
            blocks.append({"type": "paragraph", "segments": segs})

    return {"title": title, "preamble": preamble, "blocks": blocks}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    missing = [f for f in SOURCES.values() if not (ROOT / f).exists()]
    if missing:
        sys.exit(f"Missing source documents: {', '.join(missing)}")
    for slug, filename in SOURCES.items():
        data = convert(ROOT / filename)
        data["source"] = filename
        (OUT / f"{slug}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{slug}.json: {len(data['blocks'])} blocks")


if __name__ == "__main__":
    main()
