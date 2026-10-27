import { VERSION } from './engine.js';

/** Quotes alone do not prevent spreadsheet formula execution. */
export function safeText(value) {
  const raw = String(value ?? '');
  const stripped = raw.replace(/^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\ufeff]+/u, '');
  return /^[=+\-@]/u.test(stripped) || /^[\t\r\n]/u.test(raw) ? "'" + raw : raw;
}

const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
const numeric = value => value.toFixed(6).replace('.', ',');

export function recipeCsv(result) {
  const rows = [
    ['Type', 'Nom', 'Prix achat HT', 'Base prix', 'Quantité nette', 'Unité quantité', 'Rendement %', 'Valeur calculée', 'Unité valeur', 'Décimales export'],
    ['Métadonnée', safeText(result.recipeName), '', '', '', '', '', VERSION, 'Version calcul', ''],
    ['Métadonnée', 'Nombre de portions', '', '', '', '', '', numeric(result.portions), 'portions', '6'],
  ];
  if (result.salePrice) rows.push(['Métadonnée', 'Prix de vente HT par portion', '', '', '', '', '', numeric(result.salePrice), 'EUR', '6']);
  for (const row of result.ingredients) rows.push(['Ingrédient', safeText(row.name), numeric(row.price), 'EUR/' + row.priceUnit,
    numeric(row.quantity), row.quantityUnit, numeric(row.yieldPercent), numeric(row.cost), 'EUR', '6']);
  const summary = (label, value, unit) => rows.push(['Résultat', label, '', '', '', '', '', numeric(value), unit, '6']);
  summary('Coût matière recette', result.recipeCost, 'EUR');
  summary('Coût matière par portion', result.portionCost, 'EUR/portion');
  if (result.salePrice) {
    summary('Food cost', result.foodCost, '%');
    summary('Marge matière par portion', result.materialMargin, 'EUR/portion');
    summary('Marge matière', result.materialMarginPercent, '%');
  }
  rows.push(['Notice', 'Valeurs finales arrondies à 6 décimales pour export. Aucun arrondi intermédiaire. La marge matière exclut les autres charges.', '', '', '', '', '', '', '', '']);
  return '\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n') + '\r\n';
}
