"""Normalize captured WordPress media exports into a durable source index.

The REST responses themselves stay in ``tmp/`` because they may be replaced on
the live sites.  This script retains only provenance fields needed to recover
and review campaign files; it does not download or classify the creative.
"""

from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research" / "2025-election" / "official-media-index.json"

INPUTS = {
    "spd": [
        ROOT / "tmp" / "spd-files-page1.json",
        ROOT / "tmp" / "spd-images-page1.json",
        ROOT / "tmp" / "spd-images-page2.json",
        ROOT / "tmp" / "spd-images-page3.json",
    ],
    "motoriste": [
        ROOT / "tmp" / "motoriste-media-page1.json",
        ROOT / "tmp" / "motoriste-images-page1.json",
        ROOT / "tmp" / "motoriste-images-page2.json",
        ROOT / "tmp" / "motoriste-images-page3.json",
        ROOT / "tmp" / "motoriste-images-page4.json",
    ],
}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return " ".join("".join(self.parts).split())


def plain_text(value: str) -> str:
    parser = TextExtractor()
    parser.feed(unescape(value or ""))
    return parser.text()


records = []
seen = set()
for party_id, paths in INPUTS.items():
    for path in paths:
        if not path.exists():
            raise FileNotFoundError(f"Missing captured REST response: {path}")
        for item in json.loads(path.read_text(encoding="utf-8-sig")):
            source_url = item["source_url"]
            if source_url in seen:
                continue
            seen.add(source_url)
            sizes = item.get("media_details", {}).get("sizes", {})
            review_size = sizes.get("medium") or sizes.get("thumbnail") or {}
            records.append(
                {
                    "partyId": party_id,
                    "periodId": "cz-ps-2025",
                    "mediaId": item["id"],
                    "uploadedAt": item["date"],
                    "slug": item["slug"],
                    "title": plain_text(item.get("title", {}).get("rendered", "")),
                    "caption": plain_text(item.get("caption", {}).get("rendered", "")),
                    "description": plain_text(item.get("description", {}).get("rendered", "")),
                    "altText": item.get("alt_text", ""),
                    "mimeType": item["mime_type"],
                    "sourceUrl": source_url,
                    "reviewImageUrl": review_size.get("source_url") if item["mime_type"].startswith("image/") else None,
                    "width": item.get("media_details", {}).get("width"),
                    "height": item.get("media_details", {}).get("height"),
                    "parentPostId": item.get("post", 0),
                    "reviewStatus": "unreviewed-media-source",
                }
            )

records.sort(key=lambda item: (item["partyId"], item["uploadedAt"], item["mediaId"]))
counts = {
    party_id: sum(record["partyId"] == party_id for record in records)
    for party_id in INPUTS
}

OUTPUT.write_text(
    json.dumps(
        {
            "status": "Working proposal",
            "scope": (
                "Official WordPress media uploaded from 2025-01-01 through "
                "2025-10-04. An upload is a recovery lead, not necessarily a "
                "campaign promise or even a published campaign asset."
            ),
            "counts": counts,
            "records": records,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

print(json.dumps({"media": len(records), "byParty": counts}, ensure_ascii=False))
