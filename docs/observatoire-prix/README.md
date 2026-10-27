# Pilote R1 de collecte de prix publics

Rapport technique institutionnel, 27 octobre 2026, SAS La Fabrique Alimentaire / Onrush. Une seule journée est observée. Le rapport et les annotations ne constituent pas une étude d'inflation ni un classement de vendeurs.

## Reproduire les résultats publics

Python 3.12 ou compatible, aucune dépendance externe :

```sh
python -m unittest -v test_couverture.py
python analyse_couverture.py couverture-r1.csv
```

Le résultat doit correspondre à `resultats-couverture.json` : 30 lignes, 30 montants observés, 20 bases fiscales connues et 10 inconnues. La couverture est reproductible depuis les fichiers joints. Les montants bruts ne sont pas joints ; aucune reproduction publique d'une analyse de leurs niveaux n'est revendiquée.

`panier.csv` décrit dix références et leurs formats. `calendrier.csv` distingue la vague réellement effectuée des trois collectes futures programmées par automatisation. Ces collectes ne sont pas encore exécutées et ne constituent pas des observations. Les URL sont des références de provenance ; les pages peuvent évoluer après la collecte.

## Licences

CC BY 4.0 : rapport, méthode, documentation et annotations originales de couverture. MIT : nouveau code Python et tests synthétiques. Voir les deux fichiers de licence. Les marques, textes commerciaux et autres contenus des vendeurs ne sont pas couverts. Les relevés bruts, copies de catalogues, dossiers commerciaux d'acquisition et preuves internes sont exclus de ce paquet.

L'auteur est institutionnel. La collecte et la rédaction ont bénéficié de l'assistance Codex ; aucune relecture scientifique humaine n'est attestée. Aucun DOI, examen par les pairs ou dépôt effectif n'est annoncé par cette archive. Les fichiers sont recensés avec leurs empreintes SHA-256 dans `MANIFESTE.json`.
