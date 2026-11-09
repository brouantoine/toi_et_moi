"""Offline city search (GeoNames cities15000, CC-BY 4.0) and great-circle distance.

The index is loaded lazily once per process. Coordinates are rounded to 0.01 degree
(about 1 km) and never leave the backend: the API only returns names, country codes
and a rounded distance.
"""

import gzip
import math
import unicodedata
from bisect import bisect_left
from dataclasses import dataclass
from functools import cache
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "cities.tsv.gz"
MIN_QUERY = 2
EARTH_RADIUS_KM = 6371.0


@dataclass(frozen=True, slots=True)
class City:
    id: int
    name: str
    country: str
    lat: float
    lon: float
    population: int
    aliases: tuple[str, ...]

    def has_label(self, label: str) -> bool:
        return label == self.name or label in self.aliases


def fold(text: str) -> str:
    """Lowercase without accents or punctuation noise: "Montréal" -> "montreal"."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(stripped.lower().replace("-", " ").replace("'", " ").split())


@dataclass(frozen=True, slots=True)
class _Index:
    cities: dict[int, City]
    # Sorted (search key, city id, label) — a key per name/alias and per word start.
    keys: list[tuple[str, int, str]]


@cache
def _index() -> _Index:
    cities: dict[int, City] = {}
    keys: list[tuple[str, int, str]] = []
    with gzip.open(DATA_FILE, "rt", encoding="utf-8") as handle:
        for line in handle:
            gid, name, country, lat, lon, population, aliases = line.rstrip("\n").split("\t")
            city = City(
                id=int(gid),
                name=name,
                country=country,
                lat=float(lat),
                lon=float(lon),
                population=int(population),
                aliases=tuple(a for a in aliases.split("|") if a),
            )
            cities[city.id] = city
            for label in (name, *city.aliases):
                folded = fold(label)
                starts = [0] + [i + 1 for i, char in enumerate(folded) if char == " "]
                keys.extend((folded[start:], city.id, label) for start in starts)
    keys.sort()
    return _Index(cities=cities, keys=keys)


def get(city_id: int) -> City | None:
    return _index().cities.get(city_id)


def _tier(city: City, key: str, label: str, q: str) -> int:
    """Lower is better: the official name beats translations, a full start beats a word."""
    official = label == city.name
    full = key == fold(label)
    if official and full:
        return 0 if key == q else 1
    if full and key == q:
        return 2  # exact translation: "Londres"
    if official:
        return 3  # a word of the name: "york" -> "New York City"
    return 4 if full else 5


def search(query: str, limit: int = 8) -> list[tuple[City, str]]:
    """Cities whose name (or a word of it) starts with the query, best match first.

    Returns (city, label) where label is the spelling that matched ("Londres").
    """
    q = fold(query)
    if len(q) < MIN_QUERY:
        return []
    index = _index()
    best: dict[int, tuple[int, str]] = {}
    position = bisect_left(index.keys, (q, -1, ""))
    while position < len(index.keys) and index.keys[position][0].startswith(q):
        key, city_id, label = index.keys[position]
        tier = _tier(index.cities[city_id], key, label, q)
        previous = best.get(city_id)
        if previous is None or tier < previous[0]:
            best[city_id] = (tier, label)
        position += 1
    ranked = sorted(best.items(), key=lambda item: (item[1][0], -index.cities[item[0]].population))
    return [(index.cities[city_id], label) for city_id, (_, label) in ranked[:limit]]


def distance_km(a: City, b: City) -> float:
    """Great-circle (haversine) distance."""
    lat1, lon1, lat2, lon2 = map(math.radians, (a.lat, a.lon, b.lat, b.lon))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def rounded_km(km: float) -> int:
    """Friendly, deliberately coarse figure: 0 (same city), 1-19, then by 5, then by 10."""
    if km < 1:
        return 0
    if km < 20:
        return round(km)
    if km < 200:
        return int(5 * round(km / 5))
    return int(10 * round(km / 10))
