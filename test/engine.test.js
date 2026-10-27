import test from 'node:test';
import assert from 'node:assert/strict';
import { Decimal, calculateRecipe, parseDecimal, exampleRecipe, ValidationError, formatDecimal } from '../src/engine.js';
import { recipeCsv, safeText } from '../src/csv.js';

const recipe = (price, quantity, quantityUnit = 'g', { priceUnit = 'kg', yieldPercent = '100', portions = '1', salePrice = '' } = {}) =>
  ({ recipeName: 'Exemple', portions, salePrice, ingredients: [{ name: 'Ingrédient', price, quantity, quantityUnit, priceUnit, yield: yieldPercent }] });
const check = (result, expected) => { for (const [key, value] of Object.entries(expected)) assert.equal(result[key].toFixed(6), value, key); };

test('MAT-01: rendement, coût recette, portion et marges calculés sans arrondi intermédiaire', () => {
  const r = calculateRecipe(exampleRecipe());
  check(r, { recipeCost: '7.500000', portionCost: '2.500000', foodCost: '25.000000', materialMargin: '7.500000', materialMarginPercent: '75.000000' });
  assert.equal(r.ingredients[0].purchaseQuantity.toFixed(6), '0.750000');
});
test('MAT-02 / MAT-03: parité kg/g et litre/ml', () => {
  const a = calculateRecipe(recipe('10', '0,6', 'kg', { yieldPercent: '80', portions: '3', salePrice: '10' }));
  assert.equal(a.portionCost.toFixed(2), '2.50');
  const b = calculateRecipe(recipe('4', '250', 'ml', { priceUnit: 'litre', portions: '2', salePrice: '5' }));
  const c = calculateRecipe(recipe('4', '0.25', 'litre', { priceUnit: 'litre', portions: '2', salePrice: '5' }));
  check(b, { recipeCost: '1.000000', portionCost: '0.500000', foodCost: '10.000000', materialMargin: '4.500000' });
  assert.equal(c.portionCost.toFixed(6), b.portionCost.toFixed(6));
});
test('MAT-04: prix par unité', () => {
  check(calculateRecipe(recipe('0,30', '2', 'unité', { priceUnit: 'unité', salePrice: '3' })), { portionCost: '0.600000', foodCost: '20.000000', materialMargin: '2.400000' });
});
test('MAT-05: hausse fournisseur par portion et 200 portions', () => {
  const before = calculateRecipe(recipe('10', '150'));
  const after = calculateRecipe(recipe('12', '150'));
  const delta = after.portionCost.subtract(before.portionCost);
  assert.equal(delta.toFixed(2), '0.30');
  assert.equal(delta.multiply(parseDecimal('200')).toFixed(2), '60.00');
});
test('MAT-06: trois fractions de centime ne sont pas arrondies avant la somme', () => {
  const input = recipe('4', '1');
  input.ingredients = Array.from({ length: 3 }, () => ({ ...input.ingredients[0] }));
  const r = calculateRecipe(input);
  assert.equal(r.recipeCost.toFixed(6), '0.012000');
  assert.equal(r.recipeCost.toFixed(2), '0.01');
});
test('MAT-07: demi-centime exact, demi-valeur vers extérieur de zéro', () => {
  const r = calculateRecipe(recipe('10,05', '100'));
  assert.equal(r.portionCost.toFixed(6), '1.005000');
  assert.equal(r.portionCost.toFixed(2), '1.01');
  assert.equal(new Decimal(-1005n, 1000n).toFixed(2), '-1.01');
});
test('MAT-08: coût supérieur au prix conservé, marge négative', () => {
  check(calculateRecipe(recipe('12', '1', 'kg', { salePrice: '10' })), { foodCost: '120.000000', materialMargin: '-2.000000', materialMarginPercent: '-20.000000' });
});
test('MAT-09 / MAT-10: sans prix de vente et prix matière nul explicite', () => {
  const input = exampleRecipe(); input.salePrice = '';
  const r = calculateRecipe(input);
  assert.equal(r.portionCost.toFixed(2), '2.50'); assert.equal(r.foodCost, null); assert.equal(r.materialMargin, null);
  const zero = calculateRecipe(recipe('0', '100'));
  assert.equal(zero.portionCost.toFixed(2), '0.00'); assert.equal(zero.ingredients[0].zeroPrice, true);
});
test('MAT-11: plusieurs familles, portion et marge au demi-centime', () => {
  const input = exampleRecipe(); input.portions = '4'; input.salePrice = '8,50';
  input.ingredients.push({ name: 'Liquide', price: '4', priceUnit: 'litre', quantity: '250', quantityUnit: 'ml', yield: '100' });
  const r = calculateRecipe(input);
  assert.equal(r.portionCost.toFixed(2), '2.13'); assert.equal(r.materialMargin.toFixed(2), '6.38');
  assert.equal(r.foodCost.toFixed(1), '25.0');
});
test('virgule et point ont le même sens, espaces extérieurs admis', () => {
  const a = calculateRecipe(recipe(' 10,00 ', '0,600', 'kg', { yieldPercent: '80,0', portions: '3,0', salePrice: '10,0' }));
  const b = calculateRecipe(recipe('10.00', '0.600', 'kg', { yieldPercent: '80.0', portions: '3.0', salePrice: '10.0' }));
  assert.equal(a.portionCost.toFixed(6), b.portionCost.toFixed(6));
  assert.equal(formatDecimal(a.portionCost), '2,50');
});
test('formats ambigus, suffixes, négatifs, exponentiels et précision excessive refusés', () => {
  for (const value of ['1.234,56', '1,234.56', '1 234,56', '12kg', '1e3', 'NaN', 'Infinity', '-1', '1.1234567', '', '12€']) assert.throws(() => parseDecimal(value), value);
  assert.equal(parseDecimal('1,234').toFixed(3), '1.234');
});
test('divisions invalides et famille incompatible : erreurs au champ, aucun résultat partiel', () => {
  const cases = [
    [recipe('10', '100', 'g', { portions: '0' }), 'portions'],
    [recipe('10', '100', 'g', { yieldPercent: '0' }), 'ingredients.0.yield'],
    [recipe('10', '100', 'g', { yieldPercent: '101' }), 'ingredients.0.yield'],
    [recipe('10', '100', 'ml'), 'ingredients.0.quantityUnit'],
    [recipe('10', '-1'), 'ingredients.0.quantity'],
    [recipe('10', '100', 'g', { salePrice: '0' }), 'salePrice'],
  ];
  for (const [input, path] of cases) assert.throws(() => calculateRecipe(input), e => e instanceof ValidationError && e.errors.some(x => x.path === path));
});
test('ligne vide ignorée, ligne partielle bloque, aucune ligne ne produit pas de zéro trompeur', () => {
  const input = exampleRecipe(); input.ingredients.push({ name: '', price: '', quantity: '', yield: '100', priceUnit: 'kg', quantityUnit: 'g' });
  assert.equal(calculateRecipe(input).ingredients.length, 1);
  input.ingredients[1].name = 'À compléter'; assert.throws(() => calculateRecipe(input), ValidationError);
  input.ingredients = []; assert.throws(() => calculateRecipe(input), ValidationError);
});
test('export protège les champs texte des formules sans dénaturer les nombres négatifs', () => {
  for (const text of ['=1+1', ' =1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', '\t=1+1', '\r=1+1', '\u200b=1+1']) assert.ok(safeText(text).startsWith("'"), text);
  assert.equal(safeText('Légumes; frais "bio"\nDeuxième ligne'), 'Légumes; frais "bio"\nDeuxième ligne');
  const input = recipe('12', '1', 'kg', { salePrice: '10' }); input.recipeName = '=1+1'; input.ingredients[0].name = ' =1+1;"test"';
  const csv = recipeCsv(calculateRecipe(input));
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=1+1"')); assert.ok(csv.includes('"\'=1+1;""test"""'));
  assert.ok(csv.includes('"-2,000000"')); assert.equal(csv.split('\r\n')[0].split(';').length, 10);
});
test('les entrées programmatiques malformées restent des erreurs de validation', () => {
  assert.throws(() => calculateRecipe(null), ValidationError);
  const input = exampleRecipe(); input.ingredients = [null];
  assert.throws(() => calculateRecipe(input), ValidationError);
  input.ingredients = [{ name: 'Test', price: '10', quantity: '1', quantityUnit: 'kg', priceUnit: 'toString', yield: '100' }];
  assert.throws(() => calculateRecipe(input), ValidationError);
});
