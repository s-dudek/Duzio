// Eintragen (wie bei Yazio): Mahlzeit wählen, Lebensmittel oder Rezept suchen (eigene, zuletzt, Open Food Facts, Barcode),
// Menge wählen, hinzufügen. Dasselbe Fenster bearbeitet bestehende Einträge.
import { scanBarcode } from './barcode.js';
import { clean, debounce, esc, fmt, foodById, num, recipeById, round, state, toast, uuid } from './core.js';
import { addEntries, deleteEntries, saveFood, updateEntry } from './data.js';
import { today } from './dates.js';
import { openFoodEditor } from './foods.js';
import { ICON } from './icons.js';
import { MACROS, MEALS, forGrams, mealName, recipeTotals } from './nutri.js';
import { barcodeOff, searchOff } from './off.js';
import { closeSheet, openSheet, sheetHead, stepper, wireSteppers } from './sheet.js';

// Mahlzeit nach Uhrzeit vorschlagen
export function mealNow() {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h >= 17 && h < 21 ? 'dinner' : 'snack';
}

const ctx = { day: null, meal: 'snack', picks: new Map(), q: '', offSeq: 0 };

// Zeile in der Ergebnisliste; Daten liegen in ctx.picks (nichts Fremdes in Attributen)
function row(key, obj) {
  ctx.picks.set(key, obj);
  const isRecipe = key.startsWith('r:');
  const per = isRecipe ? recipeTotals(obj).per : obj;
  const sub = isRecipe ? `${fmt(per.kcal)} kcal je Portion` : `${obj.brand ? esc(obj.brand) + ' · ' : ''}${fmt(obj.kcal)} kcal / 100 ${obj.unit}`;
  return `<button class="fr" data-pick="${esc(key)}">
    <span class="fr-ic ${isRecipe ? 'rec' : obj.source === 'off' ? 'off' : ''}">${ICON[isRecipe ? 'book' : obj.fav ? 'star' : 'leaf']}</span>
    <span class="fr-t"><b>${esc(isRecipe ? obj.title : obj.name)}</b><small>${sub}</small></span>
    <span class="fr-add">${ICON.plus}</span></button>`;
}

// zuletzt eingetragene Lebensmittel und Rezepte (ohne doppelte)
function recent() {
  const seen = new Set(), out = [];
  for (let i = state.entries.length - 1; i >= 0 && out.length < 12; i--) {
    const e = state.entries[i];
    const key = e.recipe_id ? 'r:' + e.recipe_id : e.food_id ? 'f:' + e.food_id : null;
    if (!key || seen.has(key)) continue;
    const obj = e.recipe_id ? recipeById(e.recipe_id) : foodById(e.food_id);
    if (obj) { seen.add(key); out.push([key, obj]); }
  }
  return out;
}

const match = (s, q) => s.toLowerCase().includes(q);

function listHtml() {
  ctx.picks.clear();
  const q = ctx.q.toLowerCase();
  const section = (title, rows) => (rows.length ? `<div class="fs-h">${title}</div>${rows.join('')}` : '');
  if (!q) {
    const rec = recent();
    const favs = state.foods.filter((f) => f.fav).map((f) => row('f:' + f.id, f));
    const html = section('Zuletzt', rec.map(([k, o]) => row(k, o))) + section('Favoriten', favs)
      + section('Rezepte', state.recipes.slice(0, 20).map((r) => row('r:' + r.id, r)));
    return html || '<p class="empty">Suche nach einem Lebensmittel oder scanne einen Barcode.</p>';
  }
  const own = state.foods.filter((f) => match(f.name, q) || match(f.brand || '', q)).slice(0, 30).map((f) => row('f:' + f.id, f));
  const recs = state.recipes.filter((r) => match(r.title, q)).map((r) => row('r:' + r.id, r));
  return section('Meine Lebensmittel', own) + section('Rezepte', recs)
    + `<div class="fs-h">Open Food Facts</div><div class="fs-off">${q.length < 3 ? '<p class="empty">Ab 3 Buchstaben</p>' : '<div class="fs-wait">Sucht …</div>'}</div>`;
}

// ---------- Suchfenster ----------
export function openFoodSearch({ day = state.day || today(), meal = mealNow() } = {}) {
  Object.assign(ctx, { day, meal, q: '' });
  const sh = openSheet(`${sheetHead('Eintragen', {})}
    <div class="seg-view fs-meals">${MEALS.map(([k, l]) => `<button type="button" data-meal="${k}" class="${k === meal ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="fs-bar">
      <label class="fs-search">${ICON.search}<input id="fs-q" type="search" placeholder="Lebensmittel oder Rezept" autocomplete="off" enterkeyhint="search"></label>
      <button type="button" class="cbtn fs-scan" data-scan aria-label="Barcode scannen" title="Barcode scannen">${ICON.barcode}</button>
    </div>
    <div class="fs-quick">
      <button type="button" class="chip" data-new-food>${ICON.plus} Neues Lebensmittel</button>
      <button type="button" class="chip" data-quick>${ICON.flame} kcal direkt</button>
    </div>
    <div class="fs-list" id="fs-list">${listHtml()}</div>`, { full: true });

  const $list = sh.querySelector('#fs-list');
  const runOff = debounce(async (q) => {
    const seq = ++ctx.offSeq;
    try {
      const found = await searchOff(q);
      if (seq !== ctx.offSeq) return;
      const box = $list.querySelector('.fs-off');
      if (box) box.innerHTML = found.length ? found.map((f) => row(f.id, f)).join('') : '<p class="empty">Nichts gefunden</p>';
    } catch {
      if (seq === ctx.offSeq) $list.querySelector('.fs-off')?.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'Open Food Facts nicht erreichbar' }));
    }
  }, 450);

  sh.querySelector('#fs-q').addEventListener('input', (e) => {
    ctx.q = clean(e.target.value, 80);
    $list.innerHTML = listHtml();
    if (ctx.q.length >= 3) runOff(ctx.q); else ctx.offSeq++;
  });
  sh.querySelectorAll('[data-meal]').forEach((b) => b.addEventListener('click', () => {
    ctx.meal = b.dataset.meal;
    sh.querySelectorAll('[data-meal]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const key = b.dataset.pick, obj = ctx.picks.get(key);
    if (obj) key.startsWith('r:') ? openAmount({ recipe: obj }) : openAmount({ food: obj });
  });
  sh.querySelector('[data-scan]').addEventListener('click', async () => {
    const code = await scanBarcode();
    if (code) findBarcode(code);
  });
  sh.querySelector('[data-new-food]').addEventListener('click', () => openFoodEditor(null, { onSaved: (f) => openAmount({ food: f }) }));
  sh.querySelector('[data-quick]').addEventListener('click', openQuick);
}

// Barcode: zuerst eigene Lebensmittel, dann Open Food Facts
async function findBarcode(code) {
  const own = state.foods.find((f) => f.barcode === code);
  if (own) return openAmount({ food: own });
  toast('Suche Produkt …');
  try {
    const f = await barcodeOff(code);
    if (f) return openAmount({ food: f });
    toast('Produkt nicht gefunden – bitte selbst anlegen.');
    openFoodEditor({ barcode: code }, { onSaved: (food) => openAmount({ food }) });
  } catch { toast('Open Food Facts nicht erreichbar.'); }
}

// Lebensmittel von Open Food Facts beim ersten Eintragen merken (bzw. vorhandenes mit gleichem Barcode nehmen)
async function keepFood(f) {
  if (f.source !== 'off' || !String(f.id).startsWith('off:')) return f;
  const have = state.foods.find((x) => x.barcode && x.barcode === f.barcode);
  if (have) return have;
  const food = { ...f, id: uuid() };
  await saveFood(food);
  return foodById(food.id) || food;
}

// ---------- Menge wählen (neu oder bestehender Eintrag) ----------
// Einheiten: Gramm/ml, dazu Portionen des Lebensmittels; bei Rezepten Portionen
function unitsOf(food) {
  return [{ n: food.unit, g: 1 }, ...food.portions];
}

export function openAmount({ food = null, recipe = null, entry = null }) {
  if (entry) {
    recipe = entry.recipe_id ? recipeById(entry.recipe_id) : null;
    food = entry.food_id ? foodById(entry.food_id) : null;
  }
  const isRecipe = !!recipe;
  const totals = isRecipe ? recipeTotals(recipe) : null;
  const units = isRecipe ? [{ n: 'Portion', g: totals.grams / recipe.servings || 1 }] : food ? unitsOf(food) : [{ n: 'g', g: 1 }];
  let unitIdx = entry ? Math.max(0, units.findIndex((u) => u.n === entry.unit_label)) : units.length > 1 && !isRecipe ? 1 : 0;
  const startAmount = entry ? entry.amount : isRecipe ? 1 : unitIdx ? 1 : 100;
  let meal = entry ? entry.meal : ctx.meal;
  const title = isRecipe ? recipe.title : food ? food.name : entry?.name;

  const sh = openSheet(`${sheetHead(entry ? 'Eintrag' : 'Menge', { save: true, del: !!entry, saveLabel: entry ? 'Speichern' : 'Hinzufügen' })}
    <div class="am-title"><b>${esc(title)}</b>${food?.brand ? `<small>${esc(food.brand)}</small>` : ''}</div>
    <div class="seg-view fs-meals">${MEALS.map(([k, l]) => `<button type="button" data-meal="${k}" class="${k === meal ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="am-row">${stepper('am-n', startAmount, unitIdx || isRecipe ? 0.5 : 10)}
      <select id="am-u" class="select am-u" ${units.length < 2 ? 'disabled' : ''}>${units.map((u, i) => `<option value="${i}" ${i === unitIdx ? 'selected' : ''}>${esc(u.n)}${u.g !== 1 || isRecipe ? ` (${fmt(u.g)} ${food?.unit || 'g'})` : ''}</option>`).join('')}</select></div>
    <div class="am-sum" id="am-sum"></div>
    ${entry?.planned ? '<label class="am-plan"><input type="checkbox" id="am-eaten"> Gegessen (aus dem Plan ins Tagebuch)</label>' : ''}
    ${food && !entry ? `<button type="button" class="chip am-fav ${food.fav ? 'on' : ''}" data-fav>${ICON.star} Favorit</button>` : ''}`);

  const $n = sh.querySelector('#am-n'), $u = sh.querySelector('#am-u');
  const calc = () => {
    const amount = num($n.value, 0, 100000);
    const grams = amount * units[unitIdx].g;
    const per = (k) => round(totals.per[k] * amount, 1);   // Rezept: Werte je Portion mal Anzahl
    const v = isRecipe ? { kcal: per('kcal'), protein: per('protein'), fat: per('fat'), carbs: per('carbs') }
      : food ? forGrams(food, grams) : { kcal: entry.kcal, protein: entry.protein, fat: entry.fat, carbs: entry.carbs };
    return { amount, grams: round(grams, 1), ...v };
  };
  const show = () => {
    const v = calc();
    sh.querySelector('#am-sum').innerHTML = `<div class="am-kcal"><b>${fmt(v.kcal)}</b><small>kcal</small></div>
      ${MACROS.map(([k, l, c]) => `<div class="am-m" style="--mc:${c}"><b>${fmt(v[k], 1)} g</b><small>${l}</small></div>`).join('')}`;
  };
  wireSteppers(sh, show);
  $u.addEventListener('change', () => {
    unitIdx = Number($u.value);
    $n.value = unitIdx || isRecipe ? '1' : '100';
    sh.querySelector('.stepper').dataset.step = unitIdx || isRecipe ? '0.5' : '10';
    show();
  });
  sh.querySelectorAll('[data-meal]').forEach((b) => b.addEventListener('click', () => {
    meal = b.dataset.meal;
    sh.querySelectorAll('[data-meal]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  sh.querySelector('[data-fav]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget, f = await keepFood(food);
    food = { ...f, fav: !f.fav };
    await saveFood(food);
    btn.classList.toggle('on', food.fav);
  });
  show();

  sh.querySelector('[data-save]').addEventListener('click', async () => {
    const v = calc();
    if (!(v.amount > 0)) return toast('Bitte eine Menge eingeben.');
    const base = { meal, amount: v.amount, unit_label: units[unitIdx].n, grams: v.grams, kcal: v.kcal, protein: v.protein, fat: v.fat, carbs: v.carbs };
    if (entry) {
      updateEntry(entry.id, { ...base, planned: entry.planned && !sh.querySelector('#am-eaten')?.checked });
    } else {
      const f = food ? await keepFood(food) : null;
      addEntries([{ id: uuid(), day: ctx.day, name: isRecipe ? recipe.title : f.name, food_id: f?.id || null, recipe_id: recipe?.id || null, planned: ctx.day > today(), ...base }]);
      toast(`${mealName(meal)}: ${fmt(v.kcal)} kcal eingetragen`);
    }
    closeSheet();
  });
  sh.querySelector('[data-del]')?.addEventListener('click', () => { deleteEntries([entry.id]); closeSheet(); });
}

// ---------- kcal direkt (ohne Lebensmittel) ----------
function openQuick() {
  const sh = openSheet(`${sheetHead('kcal direkt', { save: true, saveLabel: 'Hinzufügen' })}
    <div class="field"><label for="q-n">Name</label><input id="q-n" class="input" placeholder="z. B. Kantine Mittag" maxlength="120"></div>
    <div class="grid2">
      <div class="field"><label for="q-k">kcal</label><input id="q-k" class="input" inputmode="decimal"></div>
      ${MACROS.map(([k, l]) => `<div class="field"><label for="q-${k}">${l} (g)</label><input id="q-${k}" class="input" inputmode="decimal"></div>`).join('')}
    </div>`);
  sh.querySelector('[data-save]').addEventListener('click', () => {
    const kcal = num(sh.querySelector('#q-k').value, 0, 20000);
    if (!kcal) return toast('Bitte kcal eingeben.');
    const m = Object.fromEntries(MACROS.map(([k]) => [k, num(sh.querySelector('#q-' + k).value, 0, 2000)]));
    addEntries([{ id: uuid(), day: ctx.day, meal: ctx.meal, name: clean(sh.querySelector('#q-n').value, 120) || 'Schnell eingetragen', amount: 1, unit_label: 'Eintrag', grams: 0, kcal, ...m, planned: false }]);
    closeSheet();
  });
}
