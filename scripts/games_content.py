"""Builds backend/games/content from reviewed source files and fetches their illustrations.

Usage: python3 scripts/games_content.py <source.json> [...]

* Source files follow the format of the content brief (one kind per file, several files
  per kind allowed); packs are merged per kind into backend/games/content/<kind>.json.
  Packs already published keep their place and their items: new packs are appended and
  new items of an existing pack are appended after its own (ids never move).
* French typography: curly apostrophes, non-breaking space before ? ! : ; and inside « ».
* Illustrations (Fluent Emoji 3D, Microsoft, MIT) are downloaded once from GitHub, resized
  to 160 px and saved to backend/games/static/games/art/<slug>.webp (WebP 82).
"""

from __future__ import annotations

import http.client
import io
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "backend" / "games" / "content"
ART = ROOT / "backend" / "games" / "static" / "games" / "art"
TREE = "https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1"
RAW = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/"
SIZE = 160
NBSP = "\u00a0"
APOSTROPHE = "\u2019"
KINDS = ("most_likely", "draw", "this_or_that", "never", "rather", "conversation", "agree", "photo")


def art_slug(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def french(text: str) -> str:
    text = " ".join(text.split()).replace("'", APOSTROPHE)
    text = re.sub(r"\s*([?!;])", NBSP + r"\1", text)
    text = re.sub(r"(?<=[^\d\s])\s*:(?=\s|$)", NBSP + ":", text)
    text = re.sub(r"«\s*", "«" + NBSP, text)
    text = re.sub(r"\s*»", NBSP + "»", text)
    return text


def english(text: str) -> str:
    return " ".join(text.split()).replace("'", APOSTROPHE)


def normalise_pack(pack: dict[str, Any]) -> dict[str, Any]:
    pack = dict(pack)
    pack["title_fr"], pack["title_en"] = french(pack["title_fr"]), english(pack["title_en"])
    items = []
    for item in pack["items"]:
        item = {k: v for k, v in item.items() if v not in (None, "") or k in ("fr", "en")}
        for key in list(item):
            if key.endswith("_art"):
                continue
            if key == "fr" or key.endswith("_fr"):
                item[key] = french(item[key])
            elif key == "en" or key.endswith("_en"):
                item[key] = english(item[key])
        items.append(item)
    pack["items"] = items
    return pack


def merge(sources: list[Path]) -> set[str]:
    incoming: dict[str, list[dict[str, Any]]] = {}
    for source in sources:
        data = json.loads(source.read_text(encoding="utf-8"))
        incoming.setdefault(data["kind"], []).extend(data["packs"])
    taken = {
        pack["slug"]
        for kind in KINDS
        if (CONTENT / f"{kind}.json").exists()
        for pack in json.loads((CONTENT / f"{kind}.json").read_text(encoding="utf-8"))["packs"]
    }
    arts: set[str] = set()
    CONTENT.mkdir(parents=True, exist_ok=True)
    for kind in KINDS:
        path = CONTENT / f"{kind}.json"
        current = json.loads(path.read_text(encoding="utf-8"))["packs"] if path.exists() else []
        by_slug = {pack["slug"]: pack for pack in current}
        for pack in map(normalise_pack, incoming.get(kind, [])):
            slug = pack["slug"]
            if slug in by_slug:  # same pack: keep its items, append the new ones only
                known = {json.dumps(i, sort_keys=True) for i in by_slug[slug]["items"]}
                by_slug[slug]["items"] += [
                    i for i in pack["items"] if json.dumps(i, sort_keys=True) not in known
                ]
                continue
            if slug in taken:
                slug = pack["slug"] = f"{kind.replace('_', '-')}-{slug}"
            taken.add(slug)
            current.append(pack)
            by_slug[slug] = pack
        for pack in current:
            arts.add(pack["art"])
            for item in pack["items"]:
                arts.update(v for k, v in item.items() if k.endswith("_art"))
        if current:
            path.write_text(
                json.dumps({"kind": kind, "packs": current}, ensure_ascii=False, indent=1) + "\n",
                encoding="utf-8",
            )
    return arts


def download(url: str, attempts: int = 4) -> bytes:
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:  # noqa: S310 - https
                return bytes(response.read())
        except (OSError, http.client.IncompleteRead):
            if attempt == attempts - 1:
                raise
    raise AssertionError


def fetch_art(names: set[str]) -> None:
    ART.mkdir(parents=True, exist_ok=True)
    missing = sorted(n for n in names if not (ART / f"{art_slug(n)}.webp").exists())
    if not missing:
        return
    with urllib.request.urlopen(TREE) as response:
        tree = json.load(response)["tree"]
    paths: dict[str, str] = {}
    for entry in tree:
        parts = entry["path"].split("/")
        if entry["path"].endswith("_3d.png") and (
            len(parts) == 4 or (len(parts) == 5 and parts[2] == "Default")
        ):
            paths[parts[1]] = entry["path"]
    for name in missing:
        raw = Image.open(io.BytesIO(download(RAW + urllib.parse.quote(paths[name]))))
        image = raw.convert("RGBA")
        image.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
        image.save(ART / f"{art_slug(name)}.webp", "WEBP", quality=82, method=6)
        print("art", name)


if __name__ == "__main__":
    fetch_art(merge([Path(p) for p in sys.argv[1:]]))
