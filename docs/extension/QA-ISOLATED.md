# Qualification isolée de l’extension Chrome

Statut à la préparation : **workflow écrit, aucune exécution ni installation réussie revendiquée**. La qualification effective doit être établie par un rapport et les captures d’une exécution identifiée. La préparation de ce document ne modifie pas le ZIP distribué.

Le workflow doit rester non déclenché jusqu’au feu vert du coordinateur et à la revue indépendante ASTRA du script et du workflow. Ce point décrit l’état convenu de cette préparation ; il ne demande pas une nouvelle autorisation de construction du calculateur.

## Objet exact et isolation

- Dépôt public ciblé : [Cyrilquesnel/onrush-food-cost](https://github.com/Cyrilquesnel/onrush-food-cost).
- Archive : `docs/extension/onrush-food-cost-1.0.0.zip` ; Manifest V3 version 1.0.0.
- Taille de référence : 108 559 octets.
- SHA-256 attendu : `c7d47ea4ea88861e3984857ce17b0b2328a3b89467d11e7727000831b4042c44`.
- Workflow : `.github/workflows/extension-qa.yml`, déclencheur **`workflow_dispatch` uniquement**. Aucun lancement sur push, pull request, schedule ou événement d’un autre workflow.
- Exécution : runner GitHub hébergé `ubuntu-22.04`, Linux x64, jetable, durée maximale de dix minutes. Aucun label `self-hosted`, runner Onrush, machine utilisateur ou exécution dans le dépôt SaaS `appresto`. Le choix 22.04 évite de dépendre des restrictions particulières de namespaces d’Ubuntu 24.04, sans désactiver aucune protection système.
- Permissions GitHub : `contents: read`. Pas de secret explicite, accès production, paiement, publication, déploiement ou modification du ZIP. Le jeton technique de checkout n’est pas persisté dans la configuration Git.

Le job vérifie le dépôt exact et son caractère public à partir de l’événement GitHub ; il refuse un autre dépôt ou un runner non hébergé par GitHub. Le navigateur doit utiliser le profil de test temporaire créé par le script, jamais un profil utilisateur ou une session connectée.

## Versions et provenance vérifiées

Chrome for Testing **156.0.8078.73**, plateforme `linux64`, révision officielle `1706539`. Ce choix est fixe dans le workflow ; aucune résolution dynamique de « latest » n’a lieu à l’exécution.

- [Métadonnées officielles figées au commit 939eaea0e99905046e3726508f41cb34167d7d2a](https://raw.githubusercontent.com/GoogleChromeLabs/chrome-for-testing/939eaea0e99905046e3726508f41cb34167d7d2a/data/known-good-versions-with-downloads.json).
- [Archive officielle de Chrome for Testing](https://storage.googleapis.com/chrome-for-testing-public/156.0.8078.73/linux64/chrome-linux64.zip).
- Runtime du script : **Node.js 22.23.4**, version présente dans le [catalogue officiel Node.js](https://nodejs.org/dist/index.json), publication indiquée le 20 octobre 2026. Il est distinct du runtime Node 24 utilisé par les actions officielles elles-mêmes.

Le workflow retrouve cette version dans les métadonnées Google figées et exige que l’URL `linux64` corresponde exactement à celle déclarée. Il télécharge le ZIP Chrome par HTTPS, en calcule le SHA-256, conserve cette empreinte et la provenance, puis extrait les fichiers avec contrôle des chemins et des liens symboliques.

**Limite d’authentification :** les métadonnées officielles observées ne fournissent pas de SHA-256 de l’archive Chrome. Le digest enregistré après téléchargement est donc une mesure de l’archive reçue, pas une signature ni une comparaison à une empreinte indépendante publiée par Google. Aucune empreinte de confiance n’est inventée. La version et l’URL sont épinglées ; l’identité binaire indépendante ne l’est pas. Si un changement de version est nécessaire, renouveler la vérification de provenance et la revue.

Le téléchargement Chrome n’a pas été effectué depuis l’environnement cloud de préparation : son domaine est hors de la liste réseau autorisée de cet environnement. Aucun proxy, miroir ou réglage de politique n’a été modifié pour contourner cette limite. Le téléchargement fait partie du futur run GitHub hébergé.

### Actions officielles épinglées

Les références suivantes ont été résolues par `git ls-remote` sur les dépôts officiels ; leur `action.yml` a été lu à l’empreinte indiquée pour confirmer le runtime. Le workflow utilise les SHA complets, pas des tags mobiles.

| Action | Version de référence | SHA du commit | Runtime de l’action |
| --- | --- | --- | --- |
| [actions/checkout](https://github.com/actions/checkout/tree/1af3b93b6815bc44a9784bd300feb67ff0d1eeb3) | v6.0.0 | `1af3b93b6815bc44a9784bd300feb67ff0d1eeb3` | Node 24 |
| [actions/setup-node](https://github.com/actions/setup-node/tree/2028fbc5c25fe9cf00d9f06a71cc4710d4507903) | v6.0.0 | `2028fbc5c25fe9cf00d9f06a71cc4710d4507903` | Node 24 |
| [actions/upload-artifact](https://github.com/actions/upload-artifact/tree/b7c566a772e6b6bfb58ed0dc250532a479d7789f) | v6.0.0 | `b7c566a772e6b6bfb58ed0dc250532a479d7789f` | Node 24 |

Commandes de vérification de ces tags :

```sh
git ls-remote https://github.com/actions/checkout.git refs/tags/v6.0.0
git ls-remote https://github.com/actions/setup-node.git refs/tags/v6.0.0
git ls-remote https://github.com/actions/upload-artifact.git refs/tags/v6.0.0
```

L’installation de `xvfb`, `xauth`, `xdotool`, `scrot`, `dbus-daemon` et des bibliothèques système nécessaires emploie les dépôts Ubuntu du runner jetable. Ces paquets et l’image `ubuntu-22.04` évoluent ; leur état n’est pas une image binaire intégralement reproductible. Les versions du navigateur, du runtime Node et des actions sont, elles, déclarées explicitement.

## Commande et règles d’exécution

Après installation des utilitaires de test et extraction du navigateur officiel :

```sh
dbus-run-session -- xvfb-run -a --server-args='-screen 0 1440x1000x24' \
  node scripts/qa-extension.mjs \
    --chrome "$RUNNER_TEMP/cft/chrome-linux64/chrome" \
    --expected-chrome-version 156.0.8078.73 \
    --output qa-artifacts
```

Il s’agit du navigateur Chrome for Testing complet en mode graphique sous Xvfb, pas de `chrome-headless-shell`. Le script doit charger les fichiers extraits de **l’archive de référence**, sans reconstruire ou réécrire son manifest pour faire passer un contrôle.

Le workflow ne désactive pas le sandbox, AppArmor ou les politiques administrées. Il ne modifie pas une politique locale pour permettre une installation interdite. Si la configuration standard du runner empêche le lancement ou le chargement, conserver l’échec et les traces ; ne pas transformer ce refus en réussite à l’aide d’un contournement.

## Preuves requises et écarts à garder ouverts

La présence d’un onglet ouvert directement sur `chrome-extension://…/index.html`, ou le passage des seuls tests du moteur, ne démontre pas que l’action native de l’extension a été déclenchée.

Pour fermer la qualification, le rapport doit distinguer et prouver :

1. **Intégrité et chargement** : SHA-256 de l’archive égal à la référence, extension/version constatées dans le navigateur, absence des permissions non prévues et état des politiques contrôlé sans modification.
2. **Action native** : interaction réelle avec l’action de l’extension dans l’interface Chrome, par clavier ou clic, puis création de l’onglet attendue via le service worker. Le contexte, la séquence et une capture doivent permettre de l’identifier. Un appel direct à la fonction JavaScript du worker ne remplace pas cette preuve.
3. **Calcul modifié** : l’exemple initial affiche 2,50 € par portion. Le test conserve 10 € HT/kg, 600 g nets, rendement 80 % et vente 10 € HT, mais remplace les trois portions par **deux**. Il exige l’invalidation de l’ancien résultat puis, après soumission, **3,75 € par portion, 37,5 % de food cost et 6,25 € de marge matière**. Le coût de la recette reste 7,50 €. Un bouton inactif qui laisserait l’exemple affiché ne peut pas satisfaire ces assertions.
4. **Exports** : deux CSV réellement téléchargés depuis l’interface sont vérifiés. Le premier doit contenir les résultats modifiés à deux portions (`3,750000`, `37,500000`, `6,250000`) et protéger les noms commençant par `=` ou `+`. Le second doit refléter le calcul modifié hors ligne ci-dessous. Distinguer téléchargement constaté et simple construction de chaîne CSV.
5. **Hors ligne avec nouveau résultat** : le test applique le mode réseau hors ligne à la session DevTools de la page, désactive son cache et recharge effectivement l’onglet. Il attend un nouvel événement de chargement, `navigator.onLine=false` et le retour de l’exemple initial à 2,50 €. Il remplace ensuite les portions par **six**, exige l’invalidation du résultat, soumet et vérifie **1,25 € par portion, 12,5 % de food cost et 8,75 € de marge matière**, ainsi que ces valeurs à six décimales dans le second CSV. La coupure est testée dans ce contexte de page, pas revendiquée pour toute la machine.
6. **Erreurs et permissions** : erreurs JavaScript/CSP consignées, permissions effectives cohérentes avec le manifest, absence d’accès non prévu à des onglets ou sites.

À la préparation, **ces six points restent à démontrer par le run**. Si le script ne couvre pas l’action native ou le rechargement hors ligne réel, ces écarts restent ouverts, même si les autres assertions réussissent. Un échec conserve le statut échec ; il n’est pas résumé comme une extension installée et fonctionnelle.

### Contrat strict de l’export des politiques Chrome 156 Linux

Le bouton d’export de `chrome://policy` produit un document dont les groupes sont sous **`policyGroups`**. Le nom du symbole C++ `kPolicyValuesKey` ne signifie pas que la clé JSON serait `policyValues`. Le test exige les trois groupes connus `chrome`, `precedence` et `extensions`, et refuse tout groupe inconnu. `chrome.policies` et `precedence.policies` doivent être des dictionnaires explicitement présents et vides ; le groupe `extensions` doit être explicitement vide pour ce ZIP, qui ne déclare aucun schéma de configuration administrée. La métadonnée `precedenceOrder` doit contenir quatre libellés non vides. Une propriété absente, `null` ou un tableau ne remplace jamais un dictionnaire vide.

Ce contrat est fondé sur les sources Chromium épinglées à **156.0.8078.73** : [constante JSON](https://raw.githubusercontent.com/chromium/chromium/156.0.8078.73/components/policy/core/browser/webui/policy_webui_constants.cc), [export UI](https://raw.githubusercontent.com/chromium/chromium/156.0.8078.73/chrome/browser/ui/webui/policy/policy_ui_handler.cc), [génération JSON](https://raw.githubusercontent.com/chromium/chromium/156.0.8078.73/components/policy/core/browser/webui/json_generation.cc), [groupes Chrome et priorité Linux](https://raw.githubusercontent.com/chromium/chromium/156.0.8078.73/components/policy/core/browser/policy_conversions.cc) et [ordre de priorité](https://raw.githubusercontent.com/chromium/chromium/156.0.8078.73/components/policy/core/browser/policy_conversions_client.cc).

Onze contrats Node ciblés couvrent le schéma vide attendu et le refus des anciens schémas, propriétés absentes, groupes inconnus, politiques administrées et types incorrects :

```sh
node scripts/qa-extension.mjs --self-test-policy
```

Ils sont exécutés avant l’installation des utilitaires du runner. Leur réussite valide le garde de lecture du JSON ; elle ne démontre pas l’absence de politiques dans un navigateur non exécuté.

### Identité du service worker et premier échec conservé

Le [premier run manuel 40647831798](https://github.com/Cyrilquesnel/onrush-food-cost/actions/runs/40647831798), au commit `88548eadd10f96be9f929e620468a95215713390`, a échoué le 28 octobre 2026 à 07:06 UTC, job `122680680927`. Le ZIP avait passé sa vérification, mais le script a lu une version `1.0` sur le premier service worker `background.js` trouvé, puis l’a comparée à `1.0.0`. Les contrôles complets d’installation, de politiques, d’action, de calcul, de CSV et de rechargement hors ligne n’ont pas été terminés. L’artefact de ce run porte l’ID `12797709499` ; cet échec reste historique et n’est pas renommé en réussite.

La [documentation des versions](https://developer.chrome.com/docs/extensions/reference/manifest/version) considère les composantes absentes comme zéro pour comparer des versions. Cela ne permet pas de remplacer l’assertion exacte sur `getManifest()` : la [documentation runtime](https://developer.chrome.com/docs/extensions/reference/api/runtime#getManifest) décrit la sérialisation du manifest complet, confirmée par [HandleGetManifest dans Chromium 156](https://github.com/chromium/chromium/blob/156.0.8078.73/extensions/renderer/api/runtime_hooks_delegate.cc#L481) et son [test de fidélité du manifest](https://github.com/chromium/chromium/blob/156.0.8078.73/extensions/renderer/api/runtime_hooks_delegate_unittest.cc#L174). Aucune normalisation de `1.0.0` vers `1.0` n’est donc revendiquée.

Le correctif sonde les workers candidats et conserve leur ID, URL, nom, version, type de manifest et CSP **avant** sélection dans `extension-candidates.json`. Il n’accepte que le nom, la version exacte `1.0.0`, Manifest V3, le worker et la CSP du ZIP validé, avec un ID cohérent avec l’URL. Les assertions strictes après sélection et les contrôles suivants restent en place. Les métadonnées du premier run n’identifient pas le worker interrogé ; l’hypothèse d’un composant Chrome sélectionné à tort ne sera confirmée que par les traces d’une nouvelle exécution.

Sept contrats ciblés refusent les composants, versions différentes, noms/CSP modifiés, anciens manifests, mauvais chemins et IDs incohérents :

```sh
node scripts/qa-extension.mjs --self-test-identity
```

Le [deuxième run 40649755650](https://github.com/Cyrilquesnel/onrush-food-cost/actions/runs/40649755650), au commit `9784672e7af8160ef3d3fbe2c347c8fff3104c6d`, a confirmé la sélection de l’extension Onrush `1.0.0` et ses permissions API/hôtes vides. Le composant Chrome `ContextualTasks` version `1.0` a été distingué et refusé. Le run a ensuite échoué sur le sélecteur du bouton d’export des politiques ; l’artefact porte l’ID `12798897864`. L’action native, les calculs et les contrôles suivants n’ont pas encore été exécutés avec succès.

Dans [le template exact Chrome 156](https://github.com/chromium/chromium/blob/156.0.8078.73/components/policy/resources/webui/policy_app.html.ts#L26), `cr-button#more-actions-button` et `cr-action-menu#actionMenu` sont dans **`policy-app.shadowRoot`**. Le bouton `button#export-policies` est un enfant du menu, initialement fermé. Le correctif attend la définition et le rendu du composant, ouvre ce menu via un événement souris, exige `menu.open` et un bouton visible, puis déclenche le téléchargement réel. Les [handlers d’ouverture et d’export](https://github.com/chromium/chromium/blob/156.0.8078.73/components/policy/resources/webui/policy_app.ts#L217) confirment ce chemin. La validation du fichier `policyGroups` reste inchangée et stricte.

Avant l’attente du DOM et à l’ouverture du menu, des diagnostics enregistrent les tags, IDs, rôles et chemins de shadow DOM, ainsi qu’une capture. Le bloc `finally` tente également un diagnostic de la page active et une capture native pour toute étape atteinte, même après une exception. Les valeurs des champs de saisie et les valeurs de politiques ne sont pas sérialisées dans ces diagnostics. Une erreur de diagnostic est consignée sans remplacer l’échec du contrôle initial. Le nom machine du contrôle d’installation est conservé, les métadonnées de l’extension étant rangées sous `extension`.

## Rapports et portée de la conclusion

Le workflow conserve pendant sept jours les rapports JSON, captures PNG, CSV de test et journaux explicitement sélectionnés dans `qa-artifacts/`, ainsi que commit source, SHA du ZIP extension, version Node, version Chrome et provenance du téléchargement Chrome. Il n’archive ni le binaire Chrome, ni un profil navigateur, ni un cache complet.

Le script écrit aussi une ligne `QA_REPORT ` suivie du rapport JSON dans le journal du job, afin que le connecteur de logs puisse relire le résultat sans téléchargement binaire. Cette trace concerne uniquement le navigateur isolé, sans compte connecté ni valeur de politique administrée ; les captures restent dans l’artefact.

L’upload s’exécute aussi après un échec afin de préserver la preuve disponible. L’absence de rapport exploitable ou de fichier de preuve n’est pas un succès implicite. Relever l’URL du run, sa tentative, le commit qualifié et les constats vérifiables avant de mettre à jour le statut public de l’extension.

Un passage réussi démontrerait le fonctionnement de ce ZIP dans cet environnement CfT Linux isolé. Il ne démontrerait pas une installation sur le poste d’un utilisateur, la compatibilité de tous les navigateurs Chrome, une validation Chrome Web Store ou une possibilité de contourner une politique d’entreprise. Aucun de ces états n’est revendiqué ici.
