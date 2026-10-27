import { VERSION, calculateRecipe, exampleRecipe, formatDecimal, UNIT_FAMILIES, ValidationError } from './engine.js';
import { recipeCsv } from './csv.js';

const $ = id => document.getElementById(id);
const form = $('recipe-form');
let result = null;
let rowCounter = 0;
const isExtension = location.protocol === 'chrome-extension:';
$('version').textContent = VERSION;
if (isExtension) {
  const link = new URL($('onrush-resource').href);
  link.searchParams.set('utm_source', 'chrome_extension');
  $('onrush-resource').href = link.href;
}

function make(tag, attributes = {}, text) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function clearErrors() {
  for (const node of form.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
  for (const node of form.querySelectorAll('.field-error')) { node.hidden = true; node.textContent = ''; }
  $('error-summary').hidden = true;
  $('error-summary').replaceChildren();
}

function invalidate() {
  result = null;
  $('results-content').hidden = true;
  $('empty-results').hidden = false;
  $('empty-results').querySelector('p').textContent = 'Vos saisies ont changé. Lancez le calcul pour afficher le résultat à jour.';
  $('example-badge').hidden = true;
  $('status').textContent = '';
  clearErrors();
}

function field(row, key, label, value, { inputmode, selectOptions } = {}) {
  const id = `ingredient-${row.dataset.id}-${key}`;
  const container = make('div', { class: 'field' });
  const input = make(selectOptions ? 'select' : 'input', { id, 'data-key': key, 'aria-describedby': `${id}-error`, autocomplete: 'off' });
  if (inputmode) input.setAttribute('inputmode', inputmode);
  if (!selectOptions && !inputmode) input.setAttribute('maxlength', '100');
  if (selectOptions) for (const [optionValue, optionText] of selectOptions) input.append(make('option', { value: optionValue }, optionText));
  input.value = value;
  container.append(make('label', { for: id }, label), input, make('span', { id: `${id}-error`, class: 'field-error', hidden: '' }));
  return { container, input };
}

function addIngredient(data = {}) {
  if ($('ingredients').children.length >= 100) return;
  const row = make('fieldset', { class: 'ingredient', 'data-id': String(rowCounter++) });
  row.append(make('legend', {}, `Ingrédient ${$('ingredients').children.length + 1}`));
  const head = make('div', { class: 'ingredient-head' });
  const name = field(row, 'name', 'Nom de l’ingrédient', data.name || '');
  const remove = make('button', { type: 'button', class: 'remove-button', 'aria-label': 'Supprimer cet ingrédient' }, '×');
  remove.addEventListener('click', () => {
    const next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    if (!$('ingredients').children.length) addIngredient();
    renumber(); invalidate();
    (next?.querySelector('input') || $('add-ingredient')).focus();
  });
  head.append(name.container, remove); row.append(head);
  const grid = make('div', { class: 'ingredient-grid' });
  const price = field(row, 'price', 'Prix d’achat HT', data.price ?? '', { inputmode: 'decimal' });
  const base = field(row, 'priceUnit', 'Base du prix', data.priceUnit || 'kg', { selectOptions: [['kg', '€ / kg'], ['litre', '€ / litre'], ['unité', '€ / unité']] });
  base.input.className = 'unit-select'; price.container.append(base.container);
  const quantity = field(row, 'quantity', 'Quantité nette', data.quantity ?? '', { inputmode: 'decimal' });
  const unit = field(row, 'quantityUnit', 'Unité de quantité', data.quantityUnit || 'g', { selectOptions: [['g', 'grammes (g)'], ['kg', 'kilogrammes (kg)'], ['ml', 'millilitres (ml)'], ['litre', 'litres'], ['unité', 'unités']] });
  unit.input.className = 'unit-select'; quantity.container.append(unit.container);
  const yieldField = field(row, 'yield', 'Rendement (%)', data.yield ?? '100', { inputmode: 'decimal' });
  const syncUnits = () => {
    const allowed = UNIT_FAMILIES[base.input.value];
    for (const option of unit.input.options) option.hidden = !allowed.includes(option.value);
    if (!allowed.includes(unit.input.value)) unit.input.value = base.input.value === 'kg' ? 'g' : base.input.value === 'litre' ? 'ml' : 'unité';
  };
  base.input.addEventListener('change', syncUnits); syncUnits();
  grid.append(price.container, quantity.container, yieldField.container); row.append(grid);
  $('ingredients').append(row); renumber();
  return name.input;
}

function renumber() {
  [...$('ingredients').children].forEach((row, index) => {
    row.querySelector('legend').textContent = `Ingrédient ${index + 1}`;
    row.querySelector('.remove-button').setAttribute('aria-label', `Supprimer l’ingrédient ${index + 1}`);
  });
  $('add-ingredient').disabled = $('ingredients').children.length >= 100;
}

function readInput() {
  return { recipeName: $('recipe-name').value, portions: $('portions').value, salePrice: $('sale-price').value,
    ingredients: [...$('ingredients').children].map(row => Object.fromEntries([...row.querySelectorAll('[data-key]')].map(input => [input.dataset.key, input.value]))) };
}

function load(input, example = false) {
  $('recipe-name').value = input.recipeName;
  $('portions').value = input.portions;
  $('sale-price').value = input.salePrice;
  $('ingredients').replaceChildren();
  for (const row of input.ingredients) addIngredient(row);
  invalidate();
  $('example-badge').hidden = !example;
}

function showErrors(errors) {
  const summary = $('error-summary');
  summary.append(make('strong', {}, 'Le calcul attend quelques corrections.'));
  const list = make('ul');
  for (const error of errors) {
    let target, messageNode;
    if (error.path.startsWith('ingredients.')) {
      const [, index, key] = error.path.split('.');
      const row = $('ingredients').children[Number(index)];
      target = row?.querySelector(`[data-key="${key}"]`);
      messageNode = target ? $(`${target.id}-error`) : null;
    } else {
      target = ({ recipeName: $('recipe-name'), portions: $('portions'), salePrice: $('sale-price') })[error.path];
      messageNode = $(`error-${error.path}`);
    }
    if (target) {
      target.setAttribute('aria-invalid', 'true');
      const current = target.getAttribute('aria-describedby') || '';
      if (messageNode && !current.split(' ').includes(messageNode.id)) target.setAttribute('aria-describedby', `${current} ${messageNode.id}`.trim());
    }
    if (messageNode) { messageNode.textContent = error.message; messageNode.hidden = false; }
    const item = make('li');
    if (target) {
      const link = make('a', { href: `#${target.id}` }, `${error.path.startsWith('ingredients.') ? `Ingrédient ${Number(error.path.split('.')[1]) + 1} : ` : ''}${error.message}`);
      link.addEventListener('click', event => { event.preventDefault(); target.focus(); }); item.append(link);
    } else item.textContent = error.message;
    list.append(item);
  }
  summary.append(list); summary.hidden = false; summary.focus();
}

function render(r) {
  $('portion-cost').textContent = `${formatDecimal(r.portionCost)} €`;
  $('recipe-cost').textContent = `${formatDecimal(r.recipeCost)} € HT`;
  for (const id of ['food-cost-row', 'margin-row', 'margin-percent-row']) $(id).hidden = !r.salePrice;
  $('sale-price-note').hidden = Boolean(r.salePrice);
  if (r.salePrice) {
    $('food-cost').textContent = `${formatDecimal(r.foodCost, 1)} %`;
    $('material-margin').textContent = `${formatDecimal(r.materialMargin)} €`;
    $('margin-percent').textContent = `${formatDecimal(r.materialMarginPercent, 1)} %`;
  }
  $('negative-note').hidden = !r.materialMargin || r.materialMargin.n >= 0n;
  $('zero-note').hidden = !r.ingredients.some(row => row.zeroPrice);
  $('cost-breakdown').replaceChildren();
  for (const row of r.ingredients) {
    const item = make('li'); item.append(make('span', {}, row.name), make('span', {}, `${formatDecimal(row.cost)} €`)); $('cost-breakdown').append(item);
  }
  $('empty-results').hidden = true; $('results-content').hidden = false;
}

function calculate(announce = true) {
  clearErrors();
  try {
    result = calculateRecipe(readInput()); render(result);
    if (announce) $('status').textContent = `Calcul à jour : ${formatDecimal(result.portionCost)} euros HT par portion.`;
  } catch (error) {
    result = null; $('results-content').hidden = true; $('empty-results').hidden = false;
    $('empty-results').querySelector('p').textContent = 'Corrigez les champs indiqués pour calculer votre recette.';
    if (error instanceof ValidationError) showErrors(error.errors);
    else { $('error-summary').textContent = 'Le calcul n’a pas abouti. Vos saisies sont conservées ; vérifiez les champs puis réessayez.'; $('error-summary').hidden = false; }
  }
}

form.addEventListener('input', invalidate);
form.addEventListener('change', invalidate);
form.addEventListener('submit', event => { event.preventDefault(); calculate(); });
$('add-ingredient').addEventListener('click', () => { const input = addIngredient(); invalidate(); input?.focus(); });
$('load-example').addEventListener('click', () => { load(exampleRecipe(), true); calculate(); });
$('clear').addEventListener('click', () => {
  load({ recipeName: '', portions: '', salePrice: '', ingredients: [{}] });
  $('empty-results').querySelector('p').textContent = 'Complétez votre recette, puis lancez le calcul.';
  $('recipe-name').focus(); $('status').textContent = 'Les saisies ont été effacées.';
});
$('export-csv').addEventListener('click', () => {
  if (!result) return;
  try {
    const blob = new Blob([recipeCsv(result)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = make('a', { href: url, download: 'calcul-food-cost-onrush.csv' });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    $('status').textContent = 'Export CSV préparé dans votre navigateur. Aucune recette envoyée à Onrush.';
  } catch {
    $('status').textContent = 'L’export n’a pas abouti. Vos calculs restent affichés ; réessayez le téléchargement.';
  }
});

load(exampleRecipe(), true); calculate(false);
