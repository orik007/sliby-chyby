"""Download small official-media thumbnails into ignored ``tmp/`` for review."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "research" / "2025-election" / "official-media-index.json"
OUTPUT = ROOT / "tmp" / "official-media-thumbnails"
ALLOWED_HOSTS = {"spd.cz", "www.spd.cz", "motoristesobe.cz", "www.motoristesobe.cz"}


data = json.loads(INDEX.read_text(encoding="utf-8"))
downloaded = 0
skipped = 0
failed = []

for record in data["records"]:
    url = record.get("reviewImageUrl")
    if not url:
        continue
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"Unexpected media host: {url}")
    suffix = Path(parsed.path).suffix.lower() or ".img"
    target_dir = OUTPUT / record["partyId"]
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{record['mediaId']}{suffix}"
    if target.exists() and target.stat().st_size:
        skipped += 1
        continue
    try:
        request = Request(url, headers={"User-Agent": "SlibyChyby research review/1.0"})
        with urlopen(request, timeout=30) as response:
            target.write_bytes(response.read())
        downloaded += 1
    except Exception as exc:  # Preserve the rest of the review batch.
        failed.append({"mediaId": record["mediaId"], "url": url, "error": str(exc)})

print(
    json.dumps(
        {"downloaded": downloaded, "alreadyPresent": skipped, "failed": failed},
        ensure_ascii=True,
    )
)
