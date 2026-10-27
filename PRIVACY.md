# Confidentialité — calculateur coût matière Onrush

Version du 27 octobre 2026. Cette notice décrit le calculateur autonome et son extension Chrome ; elle ne décrit pas l’ensemble des services Onrush.

Éditeur : SAS La Fabrique Alimentaire, sous la marque Onrush. Point d’entrée pour joindre l’éditeur : [site Onrush](https://onrush.fr).

## Ce que fait le calculateur

Les noms de recette et d’ingrédients, prix, quantités, rendements, portions et résultats restent dans la mémoire de la page du navigateur ou de l’onglet de l’extension. Les calculs ne nécessitent ni compte, ni backend, ni API Onrush. Le code ne transmet pas ces données à l’éditeur ou à un autre serveur, ne les place pas dans des paramètres d’URL et ne les joint pas à des rapports d’erreur.

Le code n’utilise ni cookie, ni `localStorage`, ni identifiant de suivi, ni outil d’analyse d’usage, ni pixels. Il ne charge pas de police ou de bibliothèque depuis un service externe. Aucune sauvegarde persistante des recettes n’est fournie. Une fermeture ou un rechargement peut effacer les saisies ; les mécanismes propres au navigateur, tels que restauration d’onglet ou remplissage automatique, dépendent de ses réglages.

## Export choisi par l’utilisateur

Le bouton d’export crée un fichier CSV dans le navigateur. Le téléchargement est déclenché par l’utilisateur et n’envoie pas une copie au serveur. Le fichier contient les données du calcul : sa conservation, ses copies et son éventuel partage relèvent ensuite des choix de l’utilisateur et des applications utilisées pour l’ouvrir.

Les champs textuels sont protégés contre l’interprétation comme formules de tableur. Cette protection peut ajouter une apostrophe visible dans l’export. Elle ne remplace pas les précautions de partage d’un fichier contenant des prix ou recettes réels.

## Extension Chrome

L’extension fonctionne avec le moteur et les ressources embarqués. Son action ouvre le calculateur dans un onglet de l’extension. Elle ne demande aucune permission d’hôte et ne lit ni les autres onglets, ni l’historique, ni les pages fournisseurs, ni le contenu du presse-papiers. Une valeur collée dans un champ provient d’un geste explicite de l’utilisateur avec la fonction native du navigateur.

Elle ne comporte pas de publicité ou de télémétrie et n’utilise pas de code exécuté à distance. Les téléchargements et données de distribution traités par le Chrome Web Store ou le navigateur relèvent de leurs propres politiques ; « calculs locaux » ne signifie pas que ces plateformes ne traitent aucune donnée technique.

## Site web et journaux de l’hébergeur

La consultation de la version web nécessite de demander ses fichiers à l’hébergeur. Celui-ci peut traiter des informations techniques de requête, comme une adresse IP, un horodatage, un navigateur ou une URL consultée, selon ses pratiques. Ces journaux éventuels sont distincts des champs de recette : le code ne transmet pas ces champs dans les requêtes.

La version web peut être hébergée sur GitHub Pages ou un autre hébergeur statique. L’URL de publication effective permet d’identifier l’hébergeur et sa politique ; aucune disponibilité publique n’est affirmée par la présente notice. La version de l’extension ne dépend pas de l’hébergeur web pour effectuer ses calculs hors ligne.

## Liens vers Onrush

Ouvrir un lien vers Onrush quitte le calculateur. Le site de destination peut traiter les informations de cette visite selon sa politique. Un lien peut comporter des paramètres de campagne identiques pour tous les visiteurs du même support afin d’identifier le canal d’origine. Il ne contient ni prix, ni ingrédient, ni nom de recette, ni identifiant utilisateur ajouté par le calculateur.

## Évolution de cette notice

L’ajout ultérieur d’une sauvegarde, d’une mesure d’usage ou d’un nouveau traitement exige une version mise à jour de la notice et des déclarations de plateforme cohérentes avec le code livré. Cette première version ne fournit aucune de ces fonctions.
