/** New, standalone code: no connection to the Onrush application. */
export const VERSION = '1.0.0';

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

export class Decimal {
  constructor(numerator, denominator = 1n) {
    if (denominator === 0n) throw new RangeError('Division par zéro.');
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    const divisor = gcd(numerator, denominator);
    this.n = numerator / divisor;
    this.d = denominator / divisor;
    Object.freeze(this);
  }
  add(other) { return new Decimal(this.n * other.d + other.n * this.d, this.d * other.d); }
  subtract(other) { return new Decimal(this.n * other.d - other.n * this.d, this.d * other.d); }
  multiply(other) { return new Decimal(this.n * other.n, this.d * other.d); }
  divide(other) { return new Decimal(this.n * other.d, this.d * other.n); }
  compare(other) { const delta = this.n * other.d - other.n * this.d; return delta < 0n ? -1 : delta > 0n ? 1 : 0; }
  toFixed(places = 2) {
    if (!Number.isInteger(places) || places < 0 || places > 20) throw new RangeError('Précision invalide.');
    const factor = 10n ** BigInt(places);
    const abs = this.n < 0n ? -this.n : this.n;
    let scaled = abs * factor / this.d;
    if ((abs * factor % this.d) * 2n >= this.d) scaled += 1n;
    const sign = this.n < 0n && scaled !== 0n ? '-' : '';
    const digits = scaled.toString().padStart(places + 1, '0');
    return sign + (places ? digits.slice(0, -places) + '.' + digits.slice(-places) : digits);
  }
  toString() { return this.toFixed(12).replace(/\.?0+$/, '') || '0'; }
}

const ZERO = new Decimal(0n);
const HUNDRED = new Decimal(100n);
const THOUSAND = new Decimal(1000n);
const MAX = new Decimal(1000000000n);
const trim = value => String(value ?? '').trim();

export function parseDecimal(value, { positive = false, max = MAX } = {}) {
  const raw = trim(value);
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(raw) || raw.length > 24) {
    throw new Error('Utilisez un nombre positif, avec au plus 6 décimales, par exemple 12,50. Sans séparateur de milliers.');
  }
  const [whole, fraction = ''] = raw.replace(',', '.').split('.');
  const result = new Decimal(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
  if (positive && result.n === 0n) throw new Error('Saisissez une valeur supérieure à zéro.');
  if (result.compare(max) > 0) throw new Error(`La valeur dépasse la limite de ${max.toFixed(0)}.`);
  return result;
}

export class ValidationError extends Error {
  constructor(errors) {
    super('Vérifiez les champs indiqués.');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export const UNIT_FAMILIES = Object.freeze({ kg: ['kg', 'g'], litre: ['litre', 'ml'], unité: ['unité'] });

export function calculateRecipe(input) {
  if (!input || typeof input !== 'object') throw new ValidationError([{ path: 'ingredients', message: 'La recette doit être un objet contenant les ingrédients.' }]);
  const errors = [];
  const read = (value, path, options) => {
    try { return parseDecimal(value, options); }
    catch (error) { errors.push({ path, message: error.message }); return ZERO; }
  };
  const recipeName = trim(input.recipeName);
  if (recipeName.length > 100) errors.push({ path: 'recipeName', message: '100 caractères maximum.' });
  const portions = read(input.portions, 'portions', { positive: true });
  const salePrice = trim(input.salePrice) === '' ? null : read(input.salePrice, 'salePrice', { positive: true });
  if (!Array.isArray(input.ingredients) || input.ingredients.length > 100) {
    errors.push({ path: 'ingredients', message: 'Utilisez de 1 à 100 lignes d’ingrédients.' });
  }
  const ingredients = [];
  for (const [index, row] of (Array.isArray(input.ingredients) ? input.ingredients.slice(0, 100) : []).entries()) {
    if (!row || typeof row !== 'object') { errors.push({ path: 'ingredients', message: `La ligne ${index + 1} est invalide.` }); continue; }
    if (!trim(row.name) && !trim(row.price) && !trim(row.quantity)) continue;
    const prefix = `ingredients.${index}`;
    const name = trim(row.name);
    if (name.length > 100) errors.push({ path: `${prefix}.name`, message: '100 caractères maximum.' });
    const price = read(row.price, `${prefix}.price`);
    const quantity = read(row.quantity, `${prefix}.quantity`);
    const yieldPercent = read(row.yield, `${prefix}.yield`, { positive: true, max: HUNDRED });
    const allowed = Object.hasOwn(UNIT_FAMILIES, row.priceUnit) ? UNIT_FAMILIES[row.priceUnit] : null;
    if (!allowed || !allowed.includes(row.quantityUnit)) {
      errors.push({ path: `${prefix}.quantityUnit`, message: 'Le prix et la quantité doivent avoir la même famille d’unités.' });
    }
    const normalizedQuantity = ['g', 'ml'].includes(row.quantityUnit) ? quantity.divide(THOUSAND) : quantity;
    // Defer division when the recipe is invalid: there is never a partial total.
    const purchaseQuantity = yieldPercent.n === 0n ? ZERO : normalizedQuantity.divide(yieldPercent.divide(HUNDRED));
    ingredients.push({ index, name: name || `Ingrédient ${index + 1}`, price, priceUnit: row.priceUnit,
      quantity, quantityUnit: row.quantityUnit, yieldPercent, purchaseQuantity,
      cost: price.multiply(purchaseQuantity), zeroPrice: price.n === 0n });
  }
  if (!ingredients.length) errors.push({ path: 'ingredients', message: 'Ajoutez au moins un ingrédient avec son prix et sa quantité.' });
  if (errors.length) throw new ValidationError(errors);
  const recipeCost = ingredients.reduce((total, row) => total.add(row.cost), ZERO);
  const portionCost = recipeCost.divide(portions);
  const foodCost = salePrice ? portionCost.divide(salePrice).multiply(HUNDRED) : null;
  const materialMargin = salePrice ? salePrice.subtract(portionCost) : null;
  const materialMarginPercent = salePrice ? materialMargin.divide(salePrice).multiply(HUNDRED) : null;
  return Object.freeze({ version: VERSION, recipeName, portions, salePrice, ingredients,
    recipeCost, portionCost, foodCost, materialMargin, materialMarginPercent });
}

export function formatDecimal(value, places = 2) {
  return value.toFixed(places).replace('-', '−').replace('.', ',');
}

export function exampleRecipe() {
  return { recipeName: 'Légumes préparés — exemple fictif', portions: '3', salePrice: '10',
    ingredients: [{ name: 'Légumes à préparer', price: '10', priceUnit: 'kg', quantity: '600', quantityUnit: 'g', yield: '80' }] };
}
