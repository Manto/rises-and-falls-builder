#!/usr/bin/env python3
"""
Scrape Sinfest webcomics and use Anthropic's vision API to find strips
containing the child/baby version of the Statue of Liberty character.
"""

import base64
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import anthropic
import httpx
from dotenv import load_dotenv

sys.stdout.reconfigure(line_buffering=True)

SCRIPTS_DIR = Path(__file__).parent
load_dotenv(SCRIPTS_DIR / ".env")

BASE_URL = "https://sinfest.xyz/btphp/comics"
RESULTS_FILE = SCRIPTS_DIR / "liberty_baby_matches.json"
PROGRESS_FILE = SCRIPTS_DIR / "liberty_baby_progress.json"
START_DATE = date(2012, 1, 1)
TARGET_MATCHES = 25

CLASSIFICATION_PROMPT = """Look at this Sinfest webcomic strip carefully.

I'm searching for strips that contain the **child or baby version of the Statue of Liberty** character. This character appears as a small girl or toddler/baby wearing or associated with a Statue of Liberty crown/tiara. She is often drawn as a cute, small child with the iconic Liberty crown spikes on her head.

Does this comic strip contain the child/baby Statue of Liberty character?

Respond with ONLY a JSON object (no markdown, no extra text):
{"match": true, "confidence": "high/medium/low", "description": "brief description of why"}

If unsure, lean toward marking it as a match with medium/low confidence so we don't miss any."""

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def load_last_date() -> str | None:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text()).get("last_date")
    return None


def save_last_date(d: str):
    PROGRESS_FILE.write_text(json.dumps({"last_date": d}))


def load_matches() -> list:
    if RESULTS_FILE.exists():
        return json.loads(RESULTS_FILE.read_text())
    return []


def save_matches(matches: list):
    RESULTS_FILE.write_text(json.dumps(matches, indent=2))


def fetch_comic_image(comic_date: date) -> bytes | None:
    """Download the comic strip image for a given date."""
    url = f"{BASE_URL}/{comic_date.isoformat()}.gif"
    for attempt in range(3):
        try:
            resp = httpx.get(url, timeout=30, follow_redirects=True)
            if resp.status_code == 200:
                return resp.content
            if resp.status_code == 404:
                return None
            print(f"    HTTP {resp.status_code} for {comic_date}, retry {attempt+1}/3")
        except httpx.HTTPError as e:
            print(f"    Network error for {comic_date}: {e}, retry {attempt+1}/3")
        time.sleep(2 ** attempt)
    return None


def classify_strip(image_data: bytes, comic_date: date) -> dict | None:
    """Use Claude vision to classify whether the strip contains baby Liberty."""
    b64 = base64.standard_b64encode(image_data).decode("utf-8")

    for attempt in range(5):
        try:
            response = client.messages.create(
                model="claude-opus-4-5-20251101",
                max_tokens=300,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/gif",
                                    "data": b64,
                                },
                            },
                            {"type": "text", "text": CLASSIFICATION_PROMPT},
                        ],
                    }
                ],
            )
            text = response.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(text)

        except anthropic.RateLimitError:
            wait = 2 ** (attempt + 2)
            print(f"    Rate limited, waiting {wait}s...")
            time.sleep(wait)
        except anthropic.APIStatusError as e:
            if e.status_code >= 500:
                wait = 2 ** (attempt + 1)
                print(f"    API error {e.status_code}, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"    API error: {e}")
                return None
        except json.JSONDecodeError:
            print(f"    Couldn't parse response for {comic_date}: {text[:200]}")
            return None
        except Exception as e:
            print(f"    Unexpected error: {e}")
            return None

    print(f"    Giving up on {comic_date} after retries")
    return None


def main():
    matches = load_matches()
    last_date = load_last_date()

    if matches:
        last_match_date = max(m["date"] for m in matches)
        resume_from = max(last_match_date, last_date or "") if last_date else last_match_date
        current = date.fromisoformat(resume_from) + timedelta(days=1)
        print(f"Resuming from {current} with {len(matches)} matches so far")
    elif last_date:
        current = date.fromisoformat(last_date) + timedelta(days=1)
        print(f"Resuming from {current} with 0 matches")
    else:
        current = START_DATE
        print(f"Starting fresh from {current}")

    today = date.today()
    checked = 0

    while current <= today and len(matches) < TARGET_MATCHES:
        print(f"[{current}] Checking... ({len(matches)}/{TARGET_MATCHES} found, #{checked+1})")

        image_data = fetch_comic_image(current)
        if image_data is None:
            print(f"    No comic found for {current}, skipping")
            current += timedelta(days=1)
            checked += 1
            continue

        result = classify_strip(image_data, current)
        if result and result.get("match"):
            img_url = f"{BASE_URL}/{current.isoformat()}.gif"
            entry = {
                "date": current.isoformat(),
                "image_url": img_url,
                "confidence": result.get("confidence", "unknown"),
                "description": result.get("description", ""),
            }
            matches.append(entry)
            print(f"    *** MATCH #{len(matches)}: {result.get('confidence')} — {result.get('description', '')[:80]}")
            save_matches(matches)
        else:
            if result:
                print(f"    No match")
            else:
                print(f"    Classification failed, skipping")

        save_last_date(current.isoformat())
        checked += 1
        current += timedelta(days=1)

        time.sleep(0.5)

    print(f"\nDone! Checked {checked} strips, found {len(matches)} matches.")
    print(f"Results saved to {RESULTS_FILE}")

    if matches:
        print("\nMatches found:")
        for m in matches:
            print(f"  {m['date']} ({m['confidence']}): {m['description'][:80]}")


if __name__ == "__main__":
    main()
