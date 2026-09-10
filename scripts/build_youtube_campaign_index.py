"""Build a discovery index of campaign-period YouTube material.

The script uses yt-dlp only for public metadata and never downloads media.  It
indexes the official ANO and SPD channel video tabs and resolves YouTube videos
embedded in Motoristé sobě's captured 2025 WordPress posts.  A channel upload
or official-site embed is a research lead, not automatically a party promise.

For the local research run, install yt-dlp into ``tmp/yt-dlp-package``.  The
temporary dependency is intentionally ignored by Git.
"""

from __future__ import annotations

from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
YTDLP_PATH = ROOT / "tmp" / "yt-dlp-package"
OUTPUT = ROOT / "research" / "2025-election" / "official-youtube-index.json"
START = "20250101"
END = "20251004"

CHANNELS = {
    "ano": "https://www.youtube.com/@anobudelip/videos",
    "spd": "https://www.youtube.com/channel/UCe0c2rUjCHtQSf2XY7ulCQA/videos",
}

MOTORISTE_POST_FILES = [
    ROOT / "tmp" / "motoriste-posts-2025-page1.json",
    ROOT / "tmp" / "motoriste-posts-2025-page2.json",
]

VIDEO_ID_PATTERN = re.compile(
    r"(?:youtube\.com/(?:embed/|watch\?(?:[^\s\"'<>]*?&)?v=)|youtu\.be/)"
    r"([A-Za-z0-9_-]{11})",
    re.IGNORECASE,
)


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


def normalized_date(info: dict[str, Any]) -> str | None:
    upload_date = info.get("upload_date")
    if upload_date and len(upload_date) == 8:
        return upload_date
    timestamp = info.get("timestamp") or info.get("release_timestamp")
    if timestamp:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y%m%d")
    return None


def record_from_info(
    party_id: str,
    info: dict[str, Any],
    discovery_kind: str,
    discovered_from: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    upload_date = normalized_date(info)
    return {
        "partyId": party_id,
        "periodId": "cz-ps-2025",
        "videoId": info.get("id"),
        "publishedAt": (
            f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
            if upload_date
            else None
        ),
        "title": info.get("title"),
        "description": info.get("description"),
        "channel": info.get("channel") or info.get("uploader"),
        "channelId": info.get("channel_id") or info.get("uploader_id"),
        "durationSeconds": info.get("duration"),
        "url": info.get("webpage_url") or f"https://www.youtube.com/watch?v={info.get('id')}",
        "discoveryKind": discovery_kind,
        "discoveredFrom": discovered_from or [],
        "sourceReview": "unreviewed",
    }


def main() -> None:
    if not YTDLP_PATH.exists():
        raise SystemExit(
            "yt-dlp is missing. Install it into tmp/yt-dlp-package before running."
        )
    sys.path.insert(0, str(YTDLP_PATH))
    from yt_dlp import YoutubeDL  # type: ignore[import-not-found]

    ydl_options = {
        "extract_flat": "in_playlist",
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "ignoreerrors": True,
    }
    records: list[dict[str, Any]] = []

    with YoutubeDL(ydl_options) as ydl:
        for party_id, channel_url in CHANNELS.items():
            result = ydl.extract_info(channel_url, download=False)
            channel_entries = [
                entry for entry in ((result or {}).get("entries") or []) if entry
            ]
            undated_entries: list[dict[str, Any]] = []
            for entry in channel_entries:
                if not entry:
                    continue
                date = normalized_date(entry)
                if date and START <= date <= END:
                    records.append(
                        record_from_info(party_id, entry, "official-party-youtube-channel")
                    )
                elif not date:
                    undated_entries.append(entry)

            # YouTube currently omits dates from flat channel entries. Resolve
            # videos in newest-first order and stop when the scan reaches 2024.
            # This avoids fetching an entire long-running channel history.
            if undated_entries:
                detail_options = {
                    "quiet": True,
                    "no_warnings": True,
                    "skip_download": True,
                    "ignoreerrors": True,
                }
                with YoutubeDL(detail_options) as detail_ydl:
                    older_streak = 0
                    for entry in undated_entries[:800]:
                        video_id = entry.get("id")
                        if not video_id:
                            continue
                        info = detail_ydl.extract_info(
                            f"https://www.youtube.com/watch?v={video_id}",
                            download=False,
                        )
                        if not info:
                            continue
                        date = normalized_date(info)
                        if date and START <= date <= END:
                            records.append(
                                record_from_info(
                                    party_id,
                                    info,
                                    "official-party-youtube-channel",
                                )
                            )
                            older_streak = 0
                        elif date and date < START:
                            older_streak += 1
                            if older_streak >= 5:
                                break
                        elif date:
                            older_streak = 0

    embedded: dict[str, list[dict[str, Any]]] = {}
    for path in MOTORISTE_POST_FILES:
        if not path.exists():
            raise FileNotFoundError(f"Missing captured WordPress response: {path}")
        for post in json.loads(path.read_text(encoding="utf-8-sig")):
            content = unescape(post.get("content", {}).get("rendered", ""))
            for video_id in sorted(set(VIDEO_ID_PATTERN.findall(content))):
                embedded.setdefault(video_id, []).append(
                    {
                        "postId": post["id"],
                        "postDate": post["date"][0:10],
                        "postTitle": plain_text(post.get("title", {}).get("rendered", "")),
                        "postUrl": post["link"],
                    }
                )

    detail_options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "ignoreerrors": True,
    }
    with YoutubeDL(detail_options) as ydl:
        for video_id, sources in embedded.items():
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )
            if info:
                records.append(
                    record_from_info(
                        "motoriste",
                        info,
                        "embedded-in-official-party-post",
                        sources,
                    )
                )

    unique: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        key = (record["partyId"], record["videoId"])
        existing = unique.get(key)
        if existing:
            existing["discoveredFrom"].extend(record["discoveredFrom"])
        else:
            unique[key] = record

    output_records = sorted(
        unique.values(),
        key=lambda item: (item["partyId"], item["publishedAt"] or "", item["videoId"]),
    )
    counts = {
        party_id: sum(record["partyId"] == party_id for record in output_records)
        for party_id in ("ano", "spd", "motoriste")
    }
    OUTPUT.write_text(
        json.dumps(
            {
                "status": "Research catalogue",
                "scope": (
                    "Public YouTube metadata for official ANO and SPD channel uploads "
                    "published from 2025-01-01 through election day, plus videos embedded "
                    "in captured Motoristé sobě campaign-period posts."
                ),
                "warning": (
                    "A video is a discovery source, not a confirmed public promise. Titles and "
                    "descriptions are insufficient where the commitment occurs only in audio."
                ),
                "counts": counts,
                "records": output_records,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"videos": len(output_records), "byParty": counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
