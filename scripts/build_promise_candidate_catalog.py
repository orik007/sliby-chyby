"""Build a review queue of possible election promises from extracted source text.

This intentionally over-collects. Every record is a research candidate, not a
published promise or assessment.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research" / "2025-election" / "candidate-promises.json"

# PDF text layout merged this heading with the following section while splitting
# the actual commitment after its introductory sentence. The replacement is the
# visually verified passage from printed page 4 of the same official programme.
MANUAL_EXCERPT_REPLACEMENTS = {
    (
        "ano-2025-election-program",
        4,
        "Nepřijmeme euro Cesta k prosperitě a zdravým veřejným financím nevede přes zvyšování daní ani dušení ekonomiky.",
    ): (
        "ČESKÁ KORUNA, NE EURO Česká koruna je klíčem k naší ekonomické suverenitě. "
        "Zavazujeme se, že naše vláda nepřijme euro ani nepodnikne žádné kroky směrem k jeho zavedení."
    ),
}

# The broad PDF extraction omitted two complete commitments and split two more
# away from the context required to identify their subject. These passages were
# visually verified in the official programme and are retained in the queue so
# later bounded review does not depend on an untracked manual insertion.
MANUAL_VERIFIED_PASSAGES = [
    {
        "sourceId": "ano-2025-election-program",
        "page": 5,
        "excerpt": "OSVOBODÍME SPROPITNÉ V GASTRONOMII OD DANĚ A POJISTNÝCH "
        "Osvobodíme dobrovolné spropitné v gastronomii od odvodů na sociální a zdravotní pojištění a daně z příjmů.",
    },
    {
        "sourceId": "ano-2025-election-program",
        "page": 5,
        "excerpt": "STÁTNÍ DLUHOPISY PRO OBČANY Nabídneme státní dluhopisy i drobným střadatelům, "
        "čímž snížíme závislost na velkých investorech a rozložíme rizika. Českým domácnostem umožníme "
        "zhodnotit úspory od 1 000 Kč až do 3 000 000 Kč prostřednictvím oblíbených Dluhopisů Republiky "
        "s prémiovým kupónem za dobu držení po dobu 6 let a osvobozením výnosů od srážkové daně.",
    },
    {
        "sourceId": "ano-2025-election-program",
        "page": 5,
        "excerpt": "OCENĚNÍ PRÁCE CELNÍKŮ Celníkům zvýšíme platy a budeme je pravidelně valorizovat. "
        "Zajistíme nástupní plat 50 tisíc korun.",
    },
    {
        "sourceId": "ano-2025-election-program",
        "page": 5,
        "excerpt": "ZMRAZENÍ PLATŮ POLITIKŮ Dokud se ekonomika pořádně nerozběhne a českým domácnostem "
        "se nezačne opět dařit, platy politiků budou zmrazeny.",
    },
]

SOURCES = [
    {
        "sourceId": "ano-2025-election-program",
        "partyId": "ano",
        "path": ROOT / "tmp" / "pdfs" / "ano-2025-program.txt",
        "url": "https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf",
    },
    {
        "sourceId": "spd-2025-election-program",
        "partyId": "spd",
        "path": ROOT / "tmp" / "pdfs" / "spd-2025-program.txt",
        "url": "https://spd.cz/wp-content/uploads/2025/09/Program-SPD-pro-volby-do-Poslanecke-snemovny-2025.pdf",
    },
    {
        "sourceId": "motoriste-2025-election-program",
        "partyId": "motoriste",
        "path": ROOT / "tmp" / "pdfs" / "motoriste-2025-program.txt",
        "url": "https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf",
    },
]

COMMITMENT_TERMS = [
    "budeme", "nebudeme", "chceme", "nechceme", "prosadíme", "prosazujeme",
    "zavedeme", "zrušíme", "zajistíme", "zvýšíme", "snížíme", "vrátíme",
    "obnovíme", "podpoříme", "posílíme", "vytvoříme", "vybudujeme", "změníme",
    "připravíme", "provedeme", "umožníme", "zachováme", "zabráníme", "omezíme",
    "odstraníme", "sjednotíme", "zrychlíme", "dokončíme", "zahájíme", "spustíme",
    "nepřipustíme", "odmítneme", "nedopustíme", "ukončíme", "zastavíme",
    "prodloužíme", "upravíme", "přepracujeme", "převedeme", "zřídíme",
    "zavedou", "bude zavedena", "bude zrušena", "bude zrušeno", "bude stanovena",
    "bude garantováno", "budou poskytovány", "bude poskytována", "stanovíme",
    "dosáhne", "dosáhneme", "budeme usilovat", "zasadíme se", "budeme trvat",
    "garantujeme", "nepřijmeme", "vystoupíme", "schválíme", "zabezpečíme",
    "zrealizujeme", "rozšíříme", "zmodernizujeme", "zprovozníme", "investujeme",
    "ochráníme", "zlepšíme", "zajistíme", "vyjednáme", "sloučíme", "zamítneme",
]

ACTION_NOUNS = (
    "zavedení", "zrušení", "zvýšení", "snížení", "omezení", "podpora", "obnova",
    "reforma", "revize", "audit", "posílení", "rozšíření", "výstavba", "ochrana",
    "zákaz", "moratorium", "převedení", "sjednocení", "digitalizace", "dokončení",
)

PAGE_RE = re.compile(r"^=== PAGE (\d+) ===$", re.MULTILINE)
SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ„])")


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def split_pages(text: str) -> list[tuple[int, str]]:
    matches = list(PAGE_RE.finditer(text))
    pages = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        pages.append((int(match.group(1)), text[start:end].strip()))
    return pages


def is_repeated_decoration(line: str) -> bool:
    cleaned = normalize(line)
    return (
        not cleaned
        or cleaned.isdigit()
        or cleaned in {"Umíme vyřešit", "i složité věci", "VOLEBNÍ PROGRAM", "2025"}
        or cleaned.startswith("Umíme vyřešit i složité věci | Volební program 2025")
    )


def bullet_blocks(page_text: str) -> list[str]:
    blocks: list[list[str]] = []
    current: list[str] | None = None
    for raw_line in page_text.splitlines():
        line = raw_line.strip()
        if is_repeated_decoration(line):
            continue
        if line.startswith(("• ", "→ ")):
            if current:
                blocks.append(current)
            current = [line[2:].strip()]
        elif current is not None:
            current.append(line)
    if current:
        blocks.append(current)
    return [normalize(" ".join(block)) for block in blocks if normalize(" ".join(block))]


def sentence_candidates(page_text: str) -> list[str]:
    lines = [line.strip() for line in page_text.splitlines() if not is_repeated_decoration(line)]
    joined = normalize(" ".join(lines).replace("• ", "").replace("→ ", ""))
    candidates = []
    for sentence in SENTENCE_RE.split(joined):
        sentence = normalize(sentence)
        lowered = sentence.casefold()
        if len(sentence) < 12:
            continue
        if any(term in lowered for term in COMMITMENT_TERMS) or lowered.startswith(ACTION_NOUNS):
            candidates.append(sentence)
    return candidates


def record_id(source_id: str, page: int, excerpt: str) -> str:
    digest = hashlib.sha256(f"{source_id}|{page}|{excerpt}".encode()).hexdigest()[:12]
    return f"candidate-{digest}"


records = []
seen = set()
for source in SOURCES:
    text = source["path"].read_text(encoding="utf-8")
    for page, page_text in split_pages(text):
        extracted = [("bullet-block", item) for item in bullet_blocks(page_text)]
        extracted.extend(("commitment-sentence", item) for item in sentence_candidates(page_text))
        for method, excerpt in extracted:
            replacement = MANUAL_EXCERPT_REPLACEMENTS.get((source["sourceId"], page, excerpt))
            if replacement is not None:
                method = "manual-verified-passage"
                excerpt = replacement
            key = (source["sourceId"], page, excerpt.casefold())
            if key in seen:
                continue
            seen.add(key)
            records.append(
                {
                    "id": record_id(source["sourceId"], page, excerpt),
                    "partyId": source["partyId"],
                    "periodId": "cz-ps-2025",
                    "sourceId": source["sourceId"],
                    "sourceUrl": source["url"],
                    "page": page,
                    "originalExcerpt": excerpt,
                    "extractionMethod": method,
                    "reviewStatus": "unreviewed-candidate",
                    "notes": "May contain multiple promises, a policy position, or non-promissory context. Human review required.",
                }
            )

for passage in MANUAL_VERIFIED_PASSAGES:
    source = next(source for source in SOURCES if source["sourceId"] == passage["sourceId"])
    excerpt = passage["excerpt"]
    key = (passage["sourceId"], passage["page"], excerpt.casefold())
    if key in seen:
        continue
    seen.add(key)
    records.append(
        {
            "id": record_id(passage["sourceId"], passage["page"], excerpt),
            "partyId": source["partyId"],
            "periodId": "cz-ps-2025",
            "sourceId": passage["sourceId"],
            "sourceUrl": source["url"],
            "page": passage["page"],
            "originalExcerpt": excerpt,
            "extractionMethod": "manual-verified-passage",
            "reviewStatus": "unreviewed-candidate",
            "notes": "Manually retained from the official PDF because broad extraction omitted or split the passage; human review required.",
        }
    )

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, default=OUTPUT, help="Write the generated review queue to this path.")
args = parser.parse_args()
output = args.output.resolve()

output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(
    json.dumps(
        {
            "status": "Working proposal",
            "scope": "Over-inclusive extraction queue from official 2025 election programmes; not production promises.",
            "records": records,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

counts = {source["partyId"]: 0 for source in SOURCES}
for record in records:
    counts[record["partyId"]] += 1
print(json.dumps({"total": len(records), "byParty": counts}, ensure_ascii=False))
