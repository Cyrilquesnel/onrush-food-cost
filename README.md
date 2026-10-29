# Calculateur coût matière et food cost — Onrush

Démonstration pédagogique : https://cyrilquesnel.github.io/onrush-food-cost/

Extension Chrome 1.0.0 : [télécharger le ZIP](https://cyrilquesnel.github.io/onrush-food-cost/extension/onrush-food-cost-1.0.0.zip) · [notice de chargement manuel sur ordinateur autorisé](docs/extension/README.md). Paquet autonome, non publié sur le Chrome Web Store.

Le ZIP décompressé a passé [onze contrôles réels dans Chrome for Testing 156 sous Linux, avec un profil isolé](docs/extension/QA-ISOLATED.md) : action native, calculs, CSV et rechargement hors ligne. [Preuve JSON conservée](docs/extension/qa-20261028.json).

Figures pédagogiques : [six exemples illustrés sur les coûts et leurs unités](docs/visuels-linkedin/README.md).

Outil pédagogique libre pour calculer le coût matière d’une recette, le coût par portion, le food cost et la marge matière. Il fonctionne sans compte, sans API et sans connexion au SaaS Onrush. Les calculs et l’export CSV sont effectués dans le navigateur.

Ce répertoire contient exclusivement du code neuf pour cet outil autonome. Aucun code ou jeu de données du SaaS Onrush n’y est incorporé.

Dépôt du projet : [Cyrilquesnel/onrush-food-cost](https://github.com/Cyrilquesnel/onrush-food-cost). La démonstration publique utilise une copie statique de cet outil, distincte du SaaS Onrush.

## Modèles Google Sheets

- [Coût matière et food cost par portion](https://docs.google.com/spreadsheets/d/1sblUDCn1eLpF93rIg6KigCm72hniUkZzfOf1IoUd_Z8/edit).
- [Seuil de rentabilité et couverts par jour](https://docs.google.com/spreadsheets/d/1c12rcZkoB9hNI_7uxvCbhfo1mDPBVggwsi_FU4TW_Us/edit).

Les deux modèles sont publics en lecture seule et contiennent des exemples fictifs. Pour saisir vos données, ouvrez un modèle puis créez votre copie dans Google Sheets. Une copie est hébergée par Google ; les originaux restent non modifiables par les visiteurs.

## Utilisation et calcul

Renseigner pour chaque ingrédient son prix d’achat **HT** par kg, litre ou unité, la quantité nette utilisée pour la recette entière et son rendement de préparation. Indiquer ensuite le nombre de portions et, éventuellement, le prix de vente HT par portion.

- Quantité achetée nécessaire = quantité nette ÷ rendement.
- Coût ingrédient = prix HT par unité d’achat × quantité achetée dans cette unité.
- Coût matière par portion = somme des coûts ingrédients ÷ nombre de portions.
- Food cost = coût matière par portion ÷ prix de vente HT × 100.
- Marge matière = prix de vente HT − coût matière par portion.

Le rendement correspond aux pertes entre achat et quantité nette **avant cuisson** : parage, épluchage, etc. Le calculateur n’estime ni densité, ni rendement de cuisson ou de réhydratation. Les conversions autorisées sont g↔kg et ml↔litre. Une quantité en ml ne se compare pas automatiquement à un prix au kg.

**Exemple fictif :** un ingrédient à 10 €/kg, 600 g nets, rendement 80 %, pour trois portions nécessite 0,75 kg acheté. Il coûte 7,50 € par recette, soit 2,50 € par portion. Avec un prix de vente de 10 € HT, le food cost est de 25 % et la marge matière de 7,50 € par portion.

La marge matière ne tient pas compte du personnel, du loyer, de l’énergie ou des autres charges. Elle ne constitue pas un bénéfice net. Le mode coût de revient et les hypothèses de charges ne font pas partie de cette première version.

### Précision et formats

Le moteur commun au site et à l’extension utilise des calculs rationnels fondés sur `BigInt`, sans arrondi monétaire intermédiaire. L’arrondi est appliqué à l’affichage final : deux décimales pour EUR et une pour les pourcentages, à la demi-valeur vers l’extérieur de zéro.

Les saisies `12,50` et `12.50` représentent le même nombre. Utiliser un seul séparateur décimal ; les séparateurs de milliers sont exclus. Ainsi `1,234` signifie 1,234, et non 1 234. Les formats mixtes tels que `1.234,56`, les devises dans les champs numériques et les notations exponentielles sont refusés. Les unités se choisissent dans les champs prévus.

Les rendements doivent être supérieurs à zéro et au plus égaux à 100 %. Les portions sont strictement positives. Sans prix de vente, le coût reste disponible, mais les ratios de vente ne sont pas calculés. Un prix de vente nul n’est pas assimilé à un prix inconnu. Les marges négatives et les food costs supérieurs à 100 % restent visibles.

La saisie est limitée à six décimales, à 1 000 000 000 par valeur et à 100 ingrédients. Les portions décimales sont admises. Ces bornes protègent le formulaire ; elles ne représentent pas les limites du SaaS Onrush.

## Développer et construire

Prérequis : **Node.js 22 ou supérieur**, avec npm. Aucune dépendance npm à installer ; les commandes s’appuient sur les modules intégrés de Node.js.

Depuis ce répertoire :

```sh
npm test
npm run build
```

La construction produit :

- `dist/site/` : site statique autonome et notice de confidentialité ;
- `dist/chrome-extension/` : extension décompressée pour chargement local ;
- `dist/chrome-extension.zip` : paquet d’extension.

Le moteur et le module CSV sont partagés depuis `src/` ; la construction les copie dans les deux distributions. Ils ne doivent pas être recopiés et modifiés séparément. Le paquet ZIP utilise un ordre de fichiers et des métadonnées fixes pour obtenir le même résultat à sources identiques ; reconstruire deux fois et comparer les empreintes permet de vérifier cette propriété.

**Maintenance de Pages :** le bloc de liens Google Sheets de `docs/index.html`, son style `.sheet-links` et la section des modèles de `docs/README.md` sont propres à la publication Pages. Les conserver lors d’une promotion de `dist/site/` vers `docs/`. Cet ajout HTML statique ne modifie pas le ZIP Chrome 1.0.0 publié ; sa qualification reste celle du paquet référencé plus haut.

Pour prévisualiser le site avec le serveur local fourni :

```sh
npm run serve
```

Ouvrir ensuite [la prévisualisation locale](http://127.0.0.1:4167). Le serveur écoute uniquement sur la machine locale. Arrêter le serveur après l’essai. Servir le site par HTTP est préférable à l’ouverture directe d’un fichier lorsque le navigateur impose des restrictions aux modules JavaScript.

## Vérifications pertinentes

Les tests doivent vérifier les cas numériques de référence : rendements, g/kg, ml/litre, unités, virgule/point, marge négative, prix de vente absent, prix nul explicite, addition de petits coûts et demi-centime. Ils contrôlent aussi les saisies invalides et la neutralisation des cellules textuelles dangereuses dans le CSV.

Le passage d’une suite automatique ne démontre pas à lui seul l’accessibilité, le fonctionnement réel dans Chrome ou l’absence de requêtes externes à l’exécution. Avant de publier une version, vérifier le parcours complet au clavier, le format mobile, les erreurs et leur correction, l’export dans les lecteurs ciblés et les requêtes réseau du calculateur. Ne pas présenter une vérification non effectuée comme acquise.

## Charger l’extension Chrome localement

1. Exécuter la construction.
2. Ouvrir la page de gestion des extensions de Chrome et activer le mode développeur.
3. Choisir « Charger l’extension non empaquetée » et sélectionner `dist/chrome-extension/`.
4. Cliquer sur l’action de l’extension : le calculateur s’ouvre dans un onglet d’extension stable.
5. Vérifier le calcul, l’export et le fonctionnement hors ligne dans cet onglet.

Le manifest est en version 3. L’extension ne demande aucune permission d’hôte ni permission `tabs`, `activeTab`, `scripting`, presse-papiers, stockage ou téléchargement. L’API d’ouverture d’un onglet de l’extension ne nécessite pas la permission de lecture des onglets. Elle ne lit pas les pages fournisseurs et ne prélève aucun prix automatiquement : saisir ou coller manuellement les valeurs.

Un onglet ouvert conserve les saisies dans sa mémoire. Le code n’enregistre pas de recette dans un stockage persistant ; ne pas compter sur une conservation après fermeture ou rechargement. La soumission et la disponibilité sur le Chrome Web Store sont des étapes distinctes du chargement local. Avant une soumission, fournir les captures réelles, les éléments de fiche et une URL publique effective de la notice de confidentialité ; aucune URL de Store n’est supposée dans ce répertoire.

## Export CSV

L’export est généré dans le navigateur et n’envoie pas la recette à un serveur. Le fichier est UTF-8 ; les en-têtes indiquent les valeurs et unités. Vérifier les options de séparateur et de locale lors de l’import dans un tableur.

Les noms libres sont échappés selon les règles CSV et protégés contre les préfixes de formule (`=`, `+`, `-`, `@` et caractères de contrôle). Une apostrophe de protection peut donc apparaître dans une cellule textuelle exportée. Cette protection n’altère pas la saisie affichée dans le calculateur. Un résultat numérique négatif reste un nombre. Ne pas retirer les protections textuelles d’un export issu de données non fiables.

## Confidentialité et limites d’hébergement

Lire [PRIVACY.md](PRIVACY.md). Le code du calculateur n’envoie ni ingrédients, ni prix, ni résultats, et ne contient pas de télémétrie. Le serveur hébergeant la version web peut néanmoins traiter des journaux techniques de consultation ; Chrome Web Store possède aussi ses propres traitements de distribution. Les visites des liens Onrush relèvent des pratiques du site de destination.

GitHub Pages est envisagé pour **la documentation et la démonstration pédagogique de cet outil libre**, avec accès direct au calcul et aux sources. Il ne sert pas à héberger le SaaS Onrush, une boutique ou un tunnel commercial. Consulter les [limites et usages de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) et vérifier la présentation finale avant activation. Si elle ne correspond pas au cadre autorisé, utiliser un hébergement adapté pour la démonstration et garder la documentation du projet sur GitHub.

Le contenu de `dist/site/` est déployable comme site statique. Contrôler les chemins sur l’URL réelle, l’accessibilité publique, l’absence de `noindex` accidentel et l’intégrité du calcul après déploiement. Aucune URL de dépôt ou de site n’est inventée ici. La publication sur une plateforme n’assure ni indexation, ni position Google, ni citation IA, ni transfert automatique d’autorité au domaine Onrush.

## Pilote de collecte des prix

Consulter le [rapport pédagogique R1 du 27 octobre 2026](https://cyrilquesnel.github.io/onrush-food-cost/observatoire-prix/) : dix références, trois catalogues et trente prix observés. Les fichiers publics permettent de reproduire la couverture et sa qualification fiscale ; ils ne contiennent aucun montant brut. Une journée observée ne permet pas de mesurer une tendance. Le rapport institutionnel, sa méthode, son code et ses licences sont joints ; cette publication Web ne constitue pas un dépôt Zenodo. Ce pilote relève de ses licences propres : CC BY 4.0 pour le rapport et les annotations originales, MIT pour son code d’analyse, hors droits tiers.

## Attribution et licence

Outil pédagogique proposé par **Onrush**, édité par **SAS La Fabrique Alimentaire**. Pour le contexte et les ressources complémentaires, consulter [Onrush](https://onrush.fr).

Maintenance et signalement d’un problème : [issues du projet](https://github.com/Cyrilquesnel/onrush-food-cost/issues) ou [contact Onrush](https://onrush.fr/contact). Fournir un exemple fictif, sans facture, recette ni prix confidentiels.

La [licence MIT](LICENSE) couvre uniquement le code original de ce calculateur, de son extension, de ses tests, de ses scripts de construction, de sa documentation associée et de ses exemples fictifs. Elle ne s’étend pas au SaaS Onrush, aux marques, logos, données clients ou contenus tiers. Voir aussi [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
