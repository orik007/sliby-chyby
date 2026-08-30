"""Build dated, labelled contact sheets from downloaded review thumbnails."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "research" / "2025-election" / "official-media-index.json"
THUMBNAILS = ROOT / "tmp" / "official-media-thumbnails"
OUTPUT = ROOT / "tmp" / "official-media-contact-sheets"

COLS = 4
ROWS = 5
CELL_WIDTH = 380
IMAGE_HEIGHT = 300
LABEL_HEIGHT = 72
SHEET_SIZE = (COLS * CELL_WIDTH, ROWS * (IMAGE_HEIGHT + LABEL_HEIGHT))


def thumbnail_path(record: dict) -> Path | None:
    url = record.get("reviewImageUrl")
    if not url:
        return None
    suffix = Path(urlparse(url).path).suffix.lower() or ".img"
    return THUMBNAILS / record["partyId"] / f"{record['mediaId']}{suffix}"


def short_label(record: dict) -> str:
    slug = record["slug"]
    if len(slug) > 43:
        slug = slug[:40] + "..."
    return f"{record['uploadedAt'][:10]}  #{record['mediaId']}\n{slug}"


data = json.loads(INDEX.read_text(encoding="utf-8"))
font = ImageFont.load_default(size=18)
OUTPUT.mkdir(parents=True, exist_ok=True)
manifest = []

for party_id in ("spd", "motoriste"):
    records = [
        record
        for record in data["records"]
        if record["partyId"] == party_id and thumbnail_path(record) and thumbnail_path(record).exists()
    ]
    records.sort(key=lambda record: (record["uploadedAt"], record["mediaId"]), reverse=True)
    for batch_number, start in enumerate(range(0, len(records), COLS * ROWS), start=1):
        batch = records[start : start + COLS * ROWS]
        sheet = Image.new("RGB", SHEET_SIZE, "#eeeeee")
        draw = ImageDraw.Draw(sheet)
        for index, record in enumerate(batch):
            col = index % COLS
            row = index // COLS
            x = col * CELL_WIDTH
            y = row * (IMAGE_HEIGHT + LABEL_HEIGHT)
            path = thumbnail_path(record)
            try:
                with Image.open(path) as source:
                    source = ImageOps.exif_transpose(source).convert("RGB")
                    image = ImageOps.contain(source, (CELL_WIDTH - 12, IMAGE_HEIGHT - 12))
                    image_x = x + (CELL_WIDTH - image.width) // 2
                    image_y = y + (IMAGE_HEIGHT - image.height) // 2
                    sheet.paste(image, (image_x, image_y))
            except Exception as exc:
                draw.text((x + 8, y + 8), f"Unreadable: {exc}", fill="red", font=font)
            draw.rectangle((x, y + IMAGE_HEIGHT, x + CELL_WIDTH - 1, y + IMAGE_HEIGHT + LABEL_HEIGHT - 1), fill="white", outline="#bbbbbb")
            draw.multiline_text((x + 8, y + IMAGE_HEIGHT + 7), short_label(record), fill="black", font=font, spacing=4)
        target = OUTPUT / f"{party_id}-{batch_number:02d}.jpg"
        sheet.save(target, quality=88)
        manifest.append({"partyId": party_id, "sheet": target.name, "mediaIds": [record["mediaId"] for record in batch]})

(OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sheets": len(manifest), "directory": str(OUTPUT)}, ensure_ascii=False))
