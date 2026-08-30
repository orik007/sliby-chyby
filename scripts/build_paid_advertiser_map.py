"""Build a coverage map of Meta advertisers linked to the 2025 campaign.

Who Targets Me exposes aggregate public Trends data for its Czech election
report.  The response identifies advertiser names and Facebook Page IDs, but
does not expose the ad creative.  This script therefore creates a discovery
and coverage ledger only; its output is never promise evidence.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research" / "2025-election" / "paid-advertiser-map.json"

BASE_URL = "https://trends.whotargets.me/api/charts"
REPORT_ID = "89edd5c9-2cad-4c31-9213-306787c3fdf1"
META_PLATFORM_ID = "ab45703a-69ed-4e64-a0ca-1e701fdf7e40"
START_DATE = "2025-09-03"
END_DATE = "2025-10-02"
ENTITIES = {
    "ano": "1aeffb29-493d-4156-b587-3f8e98f5077b",
    "spd": "cc397c43-fa11-45bf-bbbe-df4353a19a82",
    "motoriste": "9f36d813-48a9-4892-b52f-054d8c563855",
}


def fetch_records(entity_id: str) -> list[dict[str, object]]:
    query = urlencode(
        {
            "wtmx_entity_id": entity_id,
            "report_id": REPORT_ID,
            "platform_ids[]": META_PLATFORM_ID,
            "start_date": START_DATE,
            "end_date": END_DATE,
            "service_name": "daily-advertisers-line-chart",
        }
    )
    with urlopen(f"{BASE_URL}?{query}", timeout=60) as response:
        return json.load(response)


def main() -> None:
    parties: dict[str, dict[str, object]] = {}
    for party_id, entity_id in ENTITIES.items():
        advertisers: dict[str, dict[str, object]] = {}
        daily_totals: defaultdict[str, int] = defaultdict(int)
        for record in fetch_records(entity_id):
            page_id = str(record["advertiser_platform_ref"])
            amount = int(record.get("total") or 0)
            current = advertisers.setdefault(
                page_id,
                {
                    "advertiserId": record["id"],
                    "advertiserName": record["name"],
                    "facebookPageId": page_id,
                    "currency": record["currency_unit"],
                    "spendInWindow": 0,
                    "activeDates": [],
                },
            )
            current["spendInWindow"] = int(current["spendInWindow"]) + amount
            if amount > 0:
                current["activeDates"].append(record["spending_date"])
            daily_totals[str(record["spending_date"])] += amount

        parties[party_id] = {
            "whoTargetsMeEntityId": entity_id,
            "advertiserCount": len(advertisers),
            "spendInWindow": sum(daily_totals.values()),
            "advertisers": sorted(
                advertisers.values(),
                key=lambda item: (-int(item["spendInWindow"]), item["advertiserName"]),
            ),
        }

    payload = {
        "status": "Working proposal",
        "scope": {
            "report": "Who Targets Me Trends — 2025 Czechia Election",
            "reportId": REPORT_ID,
            "platform": "Meta",
            "startDate": START_DATE,
            "endDate": END_DATE,
            "retrievedOn": date.today().isoformat(),
        },
        "warning": (
            "This aggregate third-party dataset identifies advertiser pages and "
            "spending only. It does not contain original ad copy or creative and "
            "must not be cited as a promise source. A listed candidate or regional "
            "advertiser is not automatically attributable to the national party."
        ),
        "sourceUrl": (
            "https://trends.whotargets.me/reports/"
            f"{REPORT_ID}/entities?start_date={START_DATE}&end_date={END_DATE}"
        ),
        "parties": parties,
    }
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                party_id: {
                    "advertisers": data["advertiserCount"],
                    "spend": data["spendInWindow"],
                }
                for party_id, data in parties.items()
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
