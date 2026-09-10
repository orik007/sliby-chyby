"""Extract review candidates from public WordPress campaign-post exports."""

from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research" / "2025-election" / "official-web-candidates.json"
ANO_INDEX = ROOT / "research" / "2025-election" / "ano-official-news-index.json"

EXPORTS = [
    ("spd", ROOT / "tmp" / "spd-posts-2025-page1.json"),
    ("spd", ROOT / "tmp" / "spd-posts-2025-page2.json"),
    ("motoriste", ROOT / "tmp" / "motoriste-posts-2025-page1.json"),
    ("motoriste", ROOT / "tmp" / "motoriste-posts-2025-page2.json"),
]

TERMS = (
    "budeme", "nebudeme", "chceme", "nechceme", "prosadíme", "prosazujeme",
    "zavedeme", "zrušíme", "zajistíme", "zvýšíme", "snížíme", "vrátíme",
    "obnovíme", "podpoříme", "posílíme", "vytvoříme", "vybudujeme", "změníme",
    "připravíme", "provedeme", "umožníme", "zachováme", "zabráníme", "omezíme",
    "odstraníme", "sjednotíme", "zrychlíme", "dokončíme", "zahájíme", "spustíme",
    "nepřipustíme", "odmítneme", "nedopustíme", "ukončíme", "zastavíme",
    "prodloužíme", "upravíme", "přepracujeme", "převedeme", "zřídíme",
    "budeme usilovat", "zasadíme se", "budeme trvat", "garantujeme", "nepřijmeme",
    "vystoupíme", "schválíme", "zabezpečíme", "zrealizujeme", "rozšíříme",
    "zmodernizujeme", "zprovozníme", "investujeme", "ochráníme", "zlepšíme",
    "vyjednáme", "sloučíme", "nesouhlasíme", "požadujeme", "navrhneme",
)

SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ„])")


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.suppressed = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style"}:
            self.suppressed += 1
        elif tag in {"p", "div", "li", "br", "h1", "h2", "h3", "h4", "blockquote"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.suppressed:
            self.suppressed -= 1
        elif tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "blockquote"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.suppressed:
            self.parts.append(data)

    def text(self) -> str:
        return " ".join("".join(self.parts).split())


def plain_text(html: str) -> str:
    parser = TextExtractor()
    parser.feed(unescape(html))
    return parser.text()


def candidate_sentences(text: str) -> list[str]:
    values = []
    for sentence in SENTENCE_RE.split(text):
        sentence = " ".join(sentence.split()).strip()
        lowered = sentence.casefold()
        if len(sentence) >= 12 and any(term in lowered for term in TERMS):
            values.append(sentence)
    return values


def candidate_id(party_id: str, url: str, excerpt: str) -> str:
    digest = hashlib.sha256(f"{party_id}|{url}|{excerpt}".encode()).hexdigest()[:12]
    return f"web-candidate-{digest}"


posts = {}
for party_id, path in EXPORTS:
    for post in json.loads(path.read_text(encoding="utf-8")):
        posts[(party_id, post["id"])] = post

records = []
seen = set()
for (party_id, _), post in sorted(posts.items(), key=lambda item: item[1]["date"]):
    title = plain_text(post["title"]["rendered"])
    text = plain_text(post["content"]["rendered"])
    for excerpt in candidate_sentences(f"{title}. {text}"):
        key = (party_id, post["link"], excerpt.casefold())
        if key in seen:
            continue
        seen.add(key)
        records.append(
            {
                "id": candidate_id(party_id, post["link"], excerpt),
                "partyId": party_id,
                "periodId": "cz-ps-2025",
                "publishedAt": post["date"],
                "sourceTitle": title,
                "sourceUrl": post["link"],
                "sourceKind": "official-party-post",
                "originalExcerpt": excerpt,
                "sourceReview": "unreviewed",
                "attributionTier": "unreviewed-official-host",
                "notes": "Official-site post may be party-authored, an interview, or a republication. Verify speaker, context, and whether the statement was made on behalf of the party.",
            }
        )

ano_sources = json.loads(ANO_INDEX.read_text(encoding="utf-8"))
for source in sorted(ano_sources, key=lambda item: item["date"]):
    text = " ".join(part for part in (source["title"], source["excerpt"]) if part)
    for excerpt in candidate_sentences(text):
        key = ("ano", source["url"], excerpt.casefold())
        if key in seen:
            continue
        seen.add(key)
        is_party_owned = source["category"] in {"Sítě", "Tiskové zprávy", "Blogy"}
        records.append(
            {
                "id": candidate_id("ano", source["url"], excerpt),
                "partyId": "ano",
                "periodId": "cz-ps-2025",
                "publishedAt": source["date"],
                "sourceTitle": source["title"] or f"ANO {source['category']} post",
                "sourceUrl": source["url"],
                "sourceKind": "official-party-post" if is_party_owned else "media-item-indexed-by-party",
                "originalExcerpt": excerpt,
                "sourceReview": "unreviewed",
                "attributionTier": "unreviewed-official-host" if is_party_owned else "unreviewed-media-discovery",
                "notes": (
                    "Party-owned campaign item. Verify whether the statement is an explicit national party commitment and recover the full original context."
                    if is_party_owned
                    else "The official party site indexed this external media item. Treat it only as a discovery lead; verify the full quotation, speaker, context, and party attribution at the linked source."
                ),
            }
        )

OUTPUT.write_text(
    json.dumps(
        {
            "status": "Research catalogue",
            "scope": "Over-inclusive campaign-statement queue from official party websites and the ANO campaign-period news index, 2025-01-01 through 2025-10-04.",
            "sourcePostCount": len(posts) + len(ano_sources),
            "sourcePostCounts": {
                "ano": len(ano_sources),
                "spd": sum(1 for party_id, _ in posts if party_id == "spd"),
                "motoriste": sum(1 for party_id, _ in posts if party_id == "motoriste"),
            },
            "records": records,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

counts = {"ano": 0, "spd": 0, "motoriste": 0}
for record in records:
    counts[record["partyId"]] += 1
print(
    json.dumps(
        {
            "sourceItems": len(posts) + len(ano_sources),
            "wordpressPosts": len(posts),
            "anoIndexItems": len(ano_sources),
            "candidates": len(records),
            "byParty": counts,
        },
        ensure_ascii=False,
    )
)
