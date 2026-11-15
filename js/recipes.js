// Rezepte: Liste, Ansicht (Portionen umrechnen, Nährwerte), ins Tagebuch, einplanen, Zutaten auf die Einkaufsliste, Bearbeiten.
// Umschalter oben: Rezepte / Meine Lebensmittel.
import { askConfirm, clean, debounce, esc, fmt, num, recipeById, round, state, store, toast, uuid } from './core.js';
import { AISLES, addEntries, deleteRecipe, saveRecipe } from './data.js';
import { addDays, isDay, today } from './dates.js';
import { foodListHtml } from './foods.js';
import { openAmount } from './food-search.js';
import { ICON } from './icons.js';
import { MACROS, MEALS, recipeTotals } from './nutri.js';
import { pickerHtml, wirePicker } from './picker.js';
import { render } from './render.js';
import { closeSheet, openSheet, sheetHead, stepper, wireSteppers } from './sheet.js';
import { mealListHtml, recipeToMeal } from './meals.js';
import { guessAisle, mergeIntoShopping, recipeItems } from './shopping.js';

let query = '';
const TABS = [['recipes', 'Rezepte', 'Rezept oder Tag suchen'], ['meals', 'Mahlzeiten', 'Mahlzeit suchen'], ['foods', 'Lebensmittel', 'Lebensmittel suchen']];
const tabOk = (k) => (TABS.some(([t]) => t === k) ? k : 'recipes');
state.recipeFilter = tabOk(store('recipeTab'));

export const macroLine = (v) => MACROS.map(([k, l, c]) => `<span style="--mc:${c}"><i></i>${fmt(v[k])} g ${l.slice(0, 1)}</span>`).join('');

// Bereich Rezepte: Umschalter Rezepte / Mahlzeiten / Lebensmittel, Suche, Liste (Favoriten zuerst)
export function renderRecipes() {
  const tab = state.recipeFilter;
  return `<div class="seg-view rc-seg">${TABS.map(([k, l]) => `<button data-act="recipe-tab" data-id="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="fs-search card">${ICON.search}<input id="rc-q" type="search" placeholder="${TABS.find(([k]) => k === tab)[2]}" value="${esc(query)}" autocomplete="off"></label>
    <div id="rc-list">${tab === 'foods' ? foodListHtml(query) : tab === 'meals' ? mealListHtml(query) : recipeListHtml(query)}</div>`;
}

function recipeListHtml(q) {
  const s = q.toLowerCase();
  const list = state.recipes.filter((r) => !s || r.title.toLowerCase().includes(s) || r.tags.some((t) => t.toLowerCase().includes(s)))
    .sort((a, b) => b.fav - a.fav || a.title.localeCompare(b.title, 'de'));
  if (!list.length) return `<p class="empty">${s ? 'Nichts gefunden.' : 'Noch keine Rezepte. Lege eines an oder füge einen Code aus dem Chat ein.'}</p>`;
  const card = (r) => {
    const { per } = recipeTotals(r);
    return `<button class="card rc" data-act="recipe" data-id="${esc(r.id)}">
      <span class="rc-h"><b>${esc(r.title)}</b>${r.fav ? `<span class="rc-fav">${ICON.star}</span>` : ''}</span>
      <span class="rc-k"><b>${fmt(per.kcal)}</b> kcal / Portion${r.minutes ? ` · ${ICON.clock}${fmt(r.minutes)} Min.` : ''}</span>
      <span class="mline">${macroLine(per)}</span>
      ${r.tags.length ? `<span class="rc-tags">${r.tags.map((t) => `<span class="utag light">${esc(t)}</span>`).join('')}</span>` : ''}</button>`;
  };
  return `<div class="rgrid">${list.map(card).join('')}</div>`;
}

// Suche ohne die ganze Seite neu zu zeichnen (Fokus bleibt im Feld)
export const recipeQuery = debounce((v) => {
  query = clean(v, 80);
  const box = document.getElementById('rc-list');
  if (!box) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = renderRecipes();
  box.replaceWith(tmp.querySelector('#rc-list'));
}, 150);

export function setRecipeTab(k) {
  state.recipeFilter = tabOk(k);
  store('recipeTab', state.recipeFilter);
  render();
}

// ---------- Ansicht ----------
export function openRecipe(id, portions = null) {
  const r = recipeById(id);
  if (!r) return;
  let n = portions || r.servings;
  const sh = openSheet(`${sheetHead(r.title, { edit: true, del: true })}<div id="rv"></div>`, { full: true });
  const draw = () => {
    const f = n / r.servings, { per } = recipeTotals(r);
    sh.querySelector('#rv').innerHTML = `
      <div class="rv-top">
        <div class="rv-k"><b>${fmt(per.kcal)}</b><small>kcal je Portion</small></div>
        <div class="mline big">${macroLine(per)}</div>
      </div>
      <div class="rv-acts">
        <button class="btn" data-rv="diary">${ICON.diary} Ins Tagebuch</button>
        <button class="btn secondary" data-rv="plan">${ICON.calendar} Einplanen</button>
        <button class="btn secondary" data-rv="shop">${ICON.cart} Einkaufsliste</button>
        <button class="btn secondary" data-rv="meal">${ICON.fork} Als Mahlzeit</button>
        <button class="chip ${r.fav ? 'on' : ''}" data-rv="fav">${ICON.star} Favorit</button>
      </div>
      <div class="rv-h"><b>Zutaten</b>${stepper('rv-n', n, 1)}<span class="muted">Portionen</span></div>
      <ul class="rv-ing">${r.ingredients.map((i) => `<li><span>${esc(i.name)}</span><b>${i.g ? `${fmt(round(i.g * f))} g` : ''}${i.label ? ` <small>${esc(i.label)}</small>` : ''}</b></li>`).join('')}</ul>
      ${r.steps.length ? `<div class="rv-h"><b>Zubereitung</b>${r.minutes ? `<span class="muted">${ICON.clock} ${fmt(r.minutes)} Min.</span>` : ''}</div>
        <ol class="rv-steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${r.note ? `<div class="rv-h"><b>Notiz</b></div><p class="rv-note">${esc(r.note)}</p>` : ''}`;
    wireSteppers(sh.querySelector('#rv'), () => { n = num(sh.querySelector('#rv-n').value, 1, 100, r.servings); draw(); });
    sh.querySelector('[data-rv="diary"]').addEventListener('click', () => openAmount({ recipe: r }));
    sh.querySelector('[data-rv="plan"]').addEventListener('click', () => openPlan(r));
    sh.querySelector('[data-rv="shop"]').addEventListener('click', () => { mergeIntoShopping(recipeItems(r, n)); toast(`Zutaten für ${fmt(n)} Portionen auf der Einkaufsliste`); });
    sh.querySelector('[data-rv="meal"]').addEventListener('click', () => recipeToMeal(r));
    sh.querySelector('[data-rv="fav"]').addEventListener('click', () => { saveRecipe({ ...r, fav: !r.fav }); openRecipe(id, n); });
  };
  draw();
  sh.querySelector('[data-edit]').addEventListener('click', () => openRecipeEditor(r));
  sh.querySelector('[data-del]').addEventListener('click', async () => {
    if (!(await askConfirm('Rezept löschen?', 'Löschen', 'Einträge im Tagebuch bleiben erhalten.'))) return;
    deleteRecipe(id);
    closeSheet();
  });
}

// Einplanen: Tag, Mahlzeit, Portionen -> geplanter Eintrag (zählt nicht, bis er gegessen ist; Grundlage für die Einkaufsliste)
function openPlan(r) {
  const t = today();
  const sh = openSheet(`${sheetHead('Einplanen', { save: true, saveLabel: 'Einplanen' })}
    <div class="am-title"><b>${esc(r.title)}</b></div>
    <div class="field"><label for="pp-day">Tag</label><input id="pp-day" type="date" class="input" value="${addDays(t, 1)}" min="${t}"></div>
    <div class="seg-view fs-meals">${MEALS.map(([k, l]) => `<button type="button" data-meal="${k}" class="${k === 'lunch' ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="field"><label>Portionen</label>${stepper('pp-n', 1, 1)}</div>`);
  let meal = 'lunch';
  sh.querySelectorAll('[data-meal]').forEach((b) => b.addEventListener('click', () => {
    meal = b.dataset.meal;
    sh.querySelectorAll('[data-meal]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  wireSteppers(sh);
  sh.querySelector('[data-save]').addEventListener('click', () => {
    const day = sh.querySelector('#pp-day').value, n = num(sh.querySelector('#pp-n').value, 0.5, 100, 1);
    if (!isDay(day)) return toast('Bitte einen Tag wählen.');
    const { per, grams } = recipeTotals(r);
    addEntries([{ id: uuid(), day, meal, name: r.title, recipe_id: r.id, amount: n, unit_label: 'Portion', grams: round((grams / r.servings) * n),
      kcal: round(per.kcal * n, 1), protein: round(per.protein * n, 1), fat: round(per.fat * n, 1), carbs: round(per.carbs * n, 1), planned: true }]);
    closeSheet();
    toast('Eingeplant');
  });
}

// ---------- Bearbeiten ----------
export function openRecipeEditor(rec = null) {
  const r = rec ? structuredClone(rec) : { id: uuid(), title: '', servings: 2, minutes: null, tags: [], ingredients: [], steps: [], note: '', fav: false };
  const sh = openSheet(`${sheetHead(rec ? 'Rezept bearbeiten' : 'Neues Rezept', { save: true })}
    <input id="re-title" class="title-input" placeholder="Titel" maxlength="160" value="${esc(r.title)}">
    <div class="grid3">
      <div class="field"><label>Portionen</label>${stepper('re-serv', r.servings, 1)}</div>
      <div class="field"><label for="re-min">Minuten</label><input id="re-min" class="input" inputmode="numeric" value="${r.minutes ?? ''}"></div>
      <div class="field"><label for="re-tags">Tags</label><input id="re-tags" class="input" placeholder="High Protein, Schnell" value="${esc(r.tags.join(', '))}"></div>
    </div>
    <div class="field"><label>Zutaten</label>
      <div id="re-ing"></div>
      <div id="re-pk">${pickerHtml('Zutat suchen oder eintippen + Enter')}</div>
      <div class="re-sum" id="re-sum"></div></div>
    <div class="field"><label for="re-steps">Zubereitung (ein Schritt je Zeile)</label><textarea id="re-steps" class="textarea">${esc(r.steps.join('\n'))}</textarea></div>
    <div class="field"><label for="re-note">Notiz</label><textarea id="re-note" class="textarea small">${esc(r.note)}</textarea></div>`, { full: true });

  const drawIng = () => {
    sh.querySelector('#re-ing').innerHTML = r.ingredients.length ? r.ingredients.map((i, k) => `<div class="re-row" data-k="${k}">
        <span class="re-n"><b>${esc(i.name)}</b><small>${i.kcal ? `${fmt(i.kcal)} kcal / 100 g` : 'ohne Nährwerte'}</small></span>
        <input class="input re-g" inputmode="decimal" value="${i.g || ''}" aria-label="Gramm"><span class="re-u">g</span>
        <select class="select re-a" aria-label="Abteilung">${AISLES.map((a) => `<option ${a === i.aisle ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
        <button type="button" class="lgear" data-rm="${k}" aria-label="Entfernen">${ICON.close}</button></div>`).join('') : '<p class="empty">Noch keine Zutaten.</p>';
    drawSum();
  };
  const drawSum = () => {
    const servings = num(sh.querySelector('#re-serv').value, 0.5, 100, 2);
    const { per } = recipeTotals({ ...r, servings });
    sh.querySelector('#re-sum').innerHTML = `<b>${fmt(per.kcal)} kcal</b> je Portion <span class="mline">${macroLine(per)}</span>`;
  };
  const add = (ing) => { r.ingredients.push({ g: 100, label: '', aisle: guessAisle(ing.name), food_id: null, kcal: 0, protein: 0, fat: 0, carbs: 0, ...ing }); drawIng(); };
  const fromFood = (f) => ({ name: f.name, food_id: String(f.id).startsWith('off:') ? null : f.id, kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs, g: f.portions[0]?.g || 100 });

  const $ing = sh.querySelector('#re-ing');
  $ing.addEventListener('input', (e) => {
    const row = e.target.closest('.re-row');
    if (row && e.target.classList.contains('re-g')) { r.ingredients[row.dataset.k].g = num(e.target.value, 0, 100000); drawSum(); }
  });
  $ing.addEventListener('change', (e) => {
    const row = e.target.closest('.re-row');
    if (row && e.target.classList.contains('re-a')) r.ingredients[row.dataset.k].aisle = e.target.value;
  });
  $ing.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (b) { r.ingredients.splice(Number(b.dataset.rm), 1); drawIng(); }
  });
  wireSteppers(sh, drawSum);

  wirePicker(sh.querySelector('#re-pk'), (f) => add(f.id ? fromFood(f) : { name: f.name }));
  drawIng();

  sh.querySelector('[data-save]').addEventListener('click', () => {
    const title = clean(sh.querySelector('#re-title').value);
    if (!title) return toast('Bitte einen Titel eingeben.');
    const min = sh.querySelector('#re-min').value.trim();
    saveRecipe({
      ...r, title, servings: num(sh.querySelector('#re-serv').value, 0.5, 100, 2), minutes: min ? num(min, 0, 1440) : null,
      tags: sh.querySelector('#re-tags').value.split(',').map((t) => clean(t, 30)).filter(Boolean),
      steps: sh.querySelector('#re-steps').value.split('\n').map((s) => clean(s, 1000)).filter(Boolean),
      note: clean(sh.querySelector('#re-note').value, 4000, true),
    });
    openRecipe(r.id);
  });
}
