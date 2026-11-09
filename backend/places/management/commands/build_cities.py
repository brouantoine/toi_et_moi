"""Rebuilds places/data/cities.tsv.gz from GeoNames' cities15000.txt.

Download https://download.geonames.org/export/dump/cities15000.zip (CC-BY 4.0), unzip it,
then: python manage.py build_cities /path/to/cities15000.txt
"""

import csv
import gzip
import re
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from places.cities import DATA_FILE, fold

ALIAS_MIN_POPULATION = 100_000
MAX_ALIASES = 30
# Capitalized Latin-script spellings only ("Londres", "Bruxelles"), not transliterations.
LATIN_NAME = re.compile(r"^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿŒœ' .\-]+$")


class Command(BaseCommand):
    help = "Rebuild the offline city index from GeoNames cities15000.txt."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("source", type=Path)

    def handle(self, *args: Any, **options: Any) -> None:
        count = 0
        with (
            open(options["source"], encoding="utf-8") as source,
            gzip.open(DATA_FILE, "wt", encoding="utf-8", compresslevel=9) as target,
        ):
            for row in csv.reader(source, delimiter="\t", quoting=csv.QUOTE_NONE):
                gid, name, alternates, lat, lon, country = (
                    row[0],
                    row[1],
                    row[3],
                    row[4],
                    row[5],
                    row[8],
                )
                population = int(row[14] or 0)
                seen = {fold(name)}
                aliases: list[str] = []
                if population >= ALIAS_MIN_POPULATION:
                    for alias in (a.strip() for a in alternates.split(",")):
                        key = fold(alias)
                        if (
                            LATIN_NAME.match(alias)
                            and len(alias) <= 40
                            and not alias.isupper()
                            and key not in seen
                        ):
                            seen.add(key)
                            aliases.append(alias)
                fields = [
                    gid,
                    name,
                    country,
                    f"{float(lat):.2f}",
                    f"{float(lon):.2f}",
                    str(population),
                    "|".join(aliases[:MAX_ALIASES]),
                ]
                target.write("\t".join(fields) + "\n")
                count += 1
        self.stdout.write(f"{count} cities written to {DATA_FILE}")
