# Villes (recherche hors ligne)

`cities.tsv.gz` provient de [GeoNames](https://www.geonames.org/) (`cities15000`, villes de plus de 15 000 habitants), licence **CC-BY 4.0** : l'attribution « Données de villes : GeoNames (CC-BY 4.0) » figure dans les mentions légales de l'app.

Colonnes : identifiant GeoNames, nom, pays (ISO), latitude et longitude arrondies à 0,01°, population, noms alternatifs en alphabet latin (villes de plus de 100 000 habitants).

Regénérer : `python manage.py build_cities /chemin/cities15000.txt`.
