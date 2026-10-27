# Faisabilité du suivi de prix publics d'un panier chocolat et pâtisserie

Rapport de pilote R1 — 27 octobre 2026 — version 1.1.0

Éditeur et auteur institutionnel : SAS La Fabrique Alimentaire, Onrush. Collecte, code et rédaction réalisés avec l'assistance de Codex, assistant OpenAI. Aucune relecture scientifique humaine n'est attestée. Cyril Quesnel, directeur de la publication du site de l'éditeur, n'est pas déclaré comme relecteur ou validateur de ce rapport.

## Résumé

Ce pilote teste une méthode de collecte et de qualification de prix publics pour dix références de chocolat et pâtisserie dans trois catalogues. La vague R1 du 27 octobre 2026 contient trente lignes et trente montants numériques réellement lus. Vingt sont qualifiés TTC ; la base fiscale des dix montants Cerf Dellier reste inconnue dans les extractions consultées. Une seule date est observée : aucune hausse, baisse, inflation ou tendance temporelle n'est établie.

Le résultat principal est méthodologique. Une extraction par défaut omettait les dix prix CuisineAddict du panier, tandis qu'une lecture du bloc public `#main` a conservé leurs cartes et permis de compléter R1. L'absence de prix dans une extraction ne démontrait donc pas l'absence de prix sur le catalogue. Ce constat concerne les pages et les lectures documentées ; il ne constitue pas une mesure générale de qualité des extracteurs Web.

## 1. Résultats de la première vague

| Catalogue | Références ciblées | Prix lus | TTC qualifiés | Base inconnue |
| --- | --- | --- | --- | --- |
| Meilleur du Chef | 10 | 10 | 10 | 0 |
| Cerf Dellier | 10 | 10 | 0 | 10 |
| CuisineAddict | 10 | 10 | 10 | 0 |
| Total | 30 | 30 | 20 | 10 |

La couverture finale des montants est de 100 % du panier prévu ; la qualification fiscale couvre 66,7 % des lignes. Le premier relevé partiel contenait vingt montants et dix manquants, conservés dans l'historique interne. Le complément de la même journée n'est pas une deuxième vague.

Le stock doit aussi être distingué du prix. Venezuela 72 % chez Cerf Dellier était signalé en rupture dans la catégorie initiale. CuisineAddict annonçait Zéphyr et Tanzanie sous deux semaines, et les huit autres références en stock. Un montant affiché ne constitue ni une disponibilité vérifiée au paiement, ni un prix livré garanti.

## 2. Panier et collecte

Le panier comprend Inaya 65 %, Ocoa 70 %, Alunga 41 %, Zéphyr 34 %, Tanzanie 75 %, Saint-Domingue 70 %, Mexique 66 %, Venezuela 72 %, Mycryo et praliné Favorites amandes-noisettes, sous marque Cacao Barry. Neuf formats sont de 1 kg ; Mycryo est de 550 g. Les correspondances reposent sur les noms, gammes et formats ; les GTIN ne sont pas vérifiés.

Les trois sources sont les catégories de marque de Meilleur du Chef, Cerf Dellier et CuisineAddict [1–3]. Les liens produits sont conservés pour la reprise ; toutes les fiches individuelles n'ont pas été lues. Le prix retenu est celui associé au nom et au format dans la carte du catalogue, sans panier, code promotionnel, connexion ou commande.

Les premières lectures sont comprises entre 06:36:26 et 06:43:30 UTC. Le complément CuisineAddict est lu entre 15:01:13 et 15:04:09 UTC le même jour, soit 19:01:13–19:04:09 à Maurice. Ces intervalles sont groupés par lecture ; ils ne prétendent pas donner un instant individuel pour chaque produit. Les catalogues n'ont pas été observés simultanément.

Les prix de référence barrés sont séparés des prix courants. Les frais de livraison, remises négociées et conditions propres à une adresse ne sont pas inclus. Les CGV CuisineAddict indiquent des prix taxes incluses [4]. La fiche Inaya Meilleur du Chef explicite un prix taxes incluses [5]. Les CGV Cerf Dellier mentionnent un affichage HT et TTC sans qualifier le montant conservé par l'extraction ; la lecture du bloc principal Inaya ne lève pas cette ambiguïté [6–7]. Aucun taux de TVA n'est supposé.

## 3. Traitement et reproductibilité

Le relevé interne conserve les montants, les conditionnements, leurs bases fiscales, les promotions, la disponibilité, les sources et les fenêtres réelles de lecture. Le prix par kg se calcule en divisant le montant du format par sa quantité nette en kg, sans transformer un montant de base inconnue en HT ou TTC.

Les comparaisons temporelles sont réservées aux séries de même source, référence, URL produit, format, devise et base fiscale connue. Le script refuse les doublons, valeurs non finies, quantités nulles et deux vagues à la même date. Les tests synthétiques restent séparés des observations réelles. R1 seule produit zéro comparaison temporelle.

Le paquet public joint `couverture-r1.csv`, des annotations originales de présence et de qualification, et `analyse_couverture.py`. Il permet de reproduire les effectifs et taux de couverture ci-dessus. Les montants bruts et copies de catalogues ne sont pas joints, leur régime de redistribution n'étant pas établi. Le paquet ne revendique donc pas la reproductibilité publique d'une analyse des prix individuels. Le rapport n'en présente aucune comparaison de niveau entre vendeurs.

## 4. Limites et prolongement

Une marque, dix références, trois détaillants spécialisés et une journée ne représentent pas les achats de la restauration française. La comparaison commerciale est limitée par les formats, les promotions, la fiscalité incomplète, les écarts d'heure, la disponibilité et l'absence de coût livré. Ce pilote n'établit aucun classement de fournisseurs.

Le protocole longitudinal prévoit quatre vagues réelles, soit cent vingt lignes visées. Après R1, les dates cibles sont les 10 novembre, 24 novembre et 8 décembre 2026, fuseau Indian/Mauritius. Ces collectes futures sont programmées par automatisation ; elles ne sont pas encore exécutées et aucune donnée future n'est déjà attestée. Conserver les dates réellement exécutées, les changements de recette ou packaging et les manquants. Un rapport ultérieur devra documenter sa couverture et ses limites, même si les résultats ne montrent pas de variation.

## 5. Édition et conditions de réutilisation

Onrush édite des outils de gestion pour la restauration. Ce rapport est une note technique institutionnelle issue d'un pilote de collecte, sans validation externe revendiquée. L'affiliation est déclarée et aucun résultat n'est présenté comme une preuve de performance commerciale du produit.

Le rapport, la méthode et les annotations originales de couverture sont proposés sous CC BY 4.0. Le nouveau code d'analyse est sous licence MIT. Ces licences ne couvrent ni les textes commerciaux, photographies, marques, bases ou autres contenus des catalogues, ni le code et les données du SaaS Onrush. Aucun dépôt Zenodo, DOI, acceptation de plateforme ou examen par les pairs n'est annoncé par la préparation de ce fichier.

## Références

[1] Meilleur du Chef, catégorie Cacao Barry : https://www.meilleurduchef.com/en/shop/brands/cacao-barry.html

[2] Cerf Dellier, catégorie Cacao Barry : https://www.cerfdellier.com/20_cacao-barry

[3] CuisineAddict, catégorie Cacao Barry : https://www.cuisineaddict.com/acheter-barry-375.htm

[4] CuisineAddict, CGV : https://www.cuisineaddict.com/conditions-generales-de-vente.htm

[5] Meilleur du Chef, fiche Inaya 1 kg : https://www.meilleurduchef.com/en/shop/chocolate/ingredients/couverture-chocolate/gre-inaya-dark-chocolate-couverture-pistoles-1kg-65-cacao-barry.html

[6] Cerf Dellier, CGV : https://www.cerfdellier.com/content/3-conditions-generales-de-vente

[7] Cerf Dellier, fiche Inaya 1 kg : https://www.cerfdellier.com/6894-chocolat-de-couverture-noir-inaya-65-1-kg.html

[8] Éditeur Onrush, mentions légales : https://onrush.fr/mentions-legales
