# Extension Chrome gratuite — Onrush

Calculez le coût matière par portion, le food cost et la marge matière d'une recette, sans compte. Les calculs et l'export CSV restent dans le navigateur. Les saisies sont conservées en mémoire de page, sans sauvegarde persistante fournie.

[Télécharger le ZIP 1.0.0](https://cyrilquesnel.github.io/onrush-food-cost/extension/onrush-food-cost-1.0.0.zip) · [Utiliser le calculateur Web](https://cyrilquesnel.github.io/onrush-food-cost/) · [Confidentialité](https://cyrilquesnel.github.io/onrush-food-cost/privacy.html)

Cette archive 1.0.0 a été préparée le 27 octobre 2026 et est conservée sans modification. Ce paquet est fourni pour **chargement manuel sur Chrome, sur ordinateur**. Il n'est pas publié sur le Chrome Web Store. L'installation réelle de l'extension reste à vérifier sur un navigateur autorisé ; les contrôles du calculateur ne remplacent pas cette vérification.

## Installation sur un ordinateur autorisé

1. Téléchargez le ZIP et **décompressez-le** dans un dossier que vous conserverez. Le dossier doit contenir directement `manifest.json` et `index.html`.
2. Dans Chrome, ouvrez `chrome://extensions`.
3. Activez le **Mode développeur**, uniquement si votre appareil et les règles de son administrateur vous l'autorisent.
4. Cliquez sur **Charger l'extension non empaquetée**, puis sélectionnez le dossier décompressé contenant `manifest.json` : ne sélectionnez pas le ZIP.
5. Ouvrez le menu Extensions de Chrome, puis cliquez sur **Onrush — coût matière et food cost**. L'action doit ouvrir le calculateur dans son propre onglet.

Si le chargement est interdit par une politique administrée, utilisez le [calculateur Web](https://cyrilquesnel.github.io/onrush-food-cost/) ou faites vérifier l'autorisation par l'administrateur. Ne modifiez pas cette politique pour installer le paquet.

## Vérifier après installation

Avec cet **exemple fictif**, saisissez un ingrédient à **10 € HT/kg**, **600 g nets**, un rendement de **80 %**, **3 portions** et une vente de **10 € HT par portion**. Résultats attendus : **7,50 € par recette**, **2,50 € par portion**, **25 % de food cost** et **7,50 € de marge matière par portion**. Cette marge n'inclut pas le personnel, le loyer ni les autres charges.

Vérifiez ensuite l'export CSV et, après export si nécessaire, le rechargement de l'onglet d'extension sans réseau. Un rechargement peut effacer les saisies. Ces vérifications sont à réaliser sur votre installation ; leur réussite n'est pas annoncée ici.

## Version et intégrité

- Version : **1.0.0**, Manifest V3.
- Taille exacte du ZIP : **108 559 octets**.
- SHA-256 :

```text
c7d47ea4ea88861e3984857ce17b0b2328a3b89467d11e7727000831b4042c44
```

Le ZIP contient le moteur, l'interface, les ressources locales et les notices de licence. Il ne déclare aucune permission d'hôte ni lecture de vos pages ; les prix sont saisis manuellement. Le téléchargement peut produire des journaux techniques chez l'hébergeur, distincts de vos saisies.

[Code source public](https://github.com/Cyrilquesnel/onrush-food-cost) · [Signaler un problème avec un exemple fictif](https://github.com/Cyrilquesnel/onrush-food-cost/issues)
