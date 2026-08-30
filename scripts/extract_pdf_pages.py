"""Extract PDF text with stable page markers for source research."""

from pathlib import Path
import sys

import pdfplumber


def extract(source: Path) -> Path:
    destination = source.with_suffix(".txt")
    with pdfplumber.open(source) as pdf:
        pages = []
        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            pages.append(f"=== PAGE {page_number} ===\n{text.strip()}\n")
    destination.write_text("\n".join(pages), encoding="utf-8")
    return destination


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: extract_pdf_pages.py PDF [PDF ...]")
    for filename in sys.argv[1:]:
        print(extract(Path(filename)))
