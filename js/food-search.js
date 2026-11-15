// Eintragen: oben die Art wählen (Lebensmittel, Mahlzeiten, Rezepte), suchen, mit dem Stern speichern/favorisieren,
// antippen -> Menge und Frühstück/Mittag/Abend/Snacks wählen. Dasselbe Mengen-Fenster bearbeitet bestehende Einträge.
import { scanBarcode } from './barcode.js';
import { clean, debounce, esc, fmt, foodById, mealById, num, recipeById, round, state, store, toast, uuid } from './core.js';
import { addEntries, deleteEntries, saveFood, saveMeal, saveRecipe, updateEntry } from './data.js';
import { today } from './dates.js';
import { openFoodEditor } from './foods.js';
import { ICON } from './icons.js';
import { openMealEditor } from './meals.js';
import { MACROS, MEALS, forGrams, mealName, recipeTotals } from './nutri.js';
import { barcodeOff, searchOff } from './off.js';
import { openRecipeEditor } from './recipes.js';
import { closeSheet, openSheet, sheetHead, stepper, wireSteppers } from './sheet.js';

const KINDS = [['foods', 'Lebensmittel', 'Lebensmittel suchen'], ['meals', 'Mahlzeiten', 'Mahlzeit suchen'], ['recipes', 'Rezepte', 'Rezept suchen']];
const PREFIX = { foods: 'f:', meals: 'm:', recipes: 'r:' };

// Mahlzeit (Frühstück …) nach Uhrzeit vorschlagen
export function mealNow() {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h >= 17 && h < 21 ? 'dinner' : 'snack';
}

state.addKind = KINDS.some(([k]) => k === store('addKind')) ? store('addKind') : 'foods';
const ctx = { day: null, meal: null, q: '', picks: new Map(), offSeq: 0 };

// Lebensmittel von Open Food Facts beim ersten Eintragen bzw. Speichern merken (vorhandenes mit gleichem Barcode nehmen)
async function keepFood(f) {
  if (!String(f.id).startsWith('off:')) return f;
  const have = state.foods.find((x) => x.barcode && x.barcode === f.barcode);
  if (have) return have;
  const food = { ...f, id: uuid() };
  await saveFood(food);
  return foodById(food.id) || food;
}

// ---------- Ergebnisliste ----------
// Daten liegen in ctx.picks (nichts Fremdes in Attributen); Zeile = antippen zum Eintragen, Stern = Favorit
function row(key, obj) {
  ctx.picks.set(key, obj);
  const kind = key.startsWith('m:') ? 'meals' : key.startsWith('r:') ? 'recipes' : 'foods';
  const title = kind === 'foods' ? obj.name : obj.title;
  const sub = kind === 'recipes' ? `${fmt(recipeTotals(obj).per.kcal)} kcal je Portion`
    : kind === 'meals' ? `${fmt(obj.kcal)} kcal je Portion${obj.grams ? ` · ${fmt(obj.grams)} g` : ''}`
      : `${obj.brand ? esc(obj.brand) + ' · ' : ''}${fmt(obj.kcal)} kcal / 100 ${obj.unit}`;
  const off = kind === 'foods' && String(obj.id).startsWith('off:');
  return `<div class="fr">
    <button class="fr-main" data-pick="${esc(key)}">
      <span class="fr-ic ${kind === 'recipes' ? 'rec' : kind === 'meals' ? 'meal' : off ? 'off' : ''}">${ICON[kind === 'recipes' ? 'book' : kind === 'meals' ? 'fork' : 'leaf']}</span>
      <span class="fr-t"><b>${esc(title)}</b><small>${sub}</small></span></button>
    <button class="fr-star ${obj.fav ? 'on' : ''}" data-star="${esc(key)}" aria-label="${obj.fav ? 'Kein Favorit mehr' : off ? 'Speichern und favorisieren' : 'Favorit'}">${ICON.star}</button>
    <button class="fr-add" data-pick="${esc(key)}" aria-label="Eintragen">${ICON.plus}</button></div>`;
}

const listOf = (kind) => (kind === 'foods' ? state.foods : kind === 'meals' ? state.meals : state.recipes);
const nameOf = (o) => (o.name ?? o.title).toLowerCase();

// zuletzt eingetragene der gewählten Art (ohne doppelte)
function recent(kind) {
  const col = { foods: 'food_id', meals: 'saved_meal_id', recipes: 'recipe_id' }[kind];
  const seen = new Set(), out = [];
  for (let i = state.entries.length - 1; i >= 0 && out.length < 10; i--) {
    const id = state.entries[i][col];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const obj = listOf(kind).find((x) => x.id === id);
    if (obj) out.push(obj);
  }
  return out;
}

const section = (title, rows) => (rows.length ? `<div class="fs-h">${title}</div>${rows.join('')}` : '');
const EMPTY = {
  foods: 'Suche nach einem Lebensmittel oder scanne einen Barcode.',
  meals: 'Noch keine Mahlzeiten. Lege eine an oder wandle ein Rezept um (Rezept öffnen → „Als Mahlzeit“).',
  recipes: 'Noch keine Rezepte.',
};

function listHtml() {
  ctx.picks.clear();
  const kind = state.addKind, p = PREFIX[kind], q = ctx.q.toLowerCase(), all = listOf(kind);
  const r = (o) => row(p + o.id, o);
  if (!q) {
    const favs = all.filter((o) => o.fav), rec = recent(kind).filter((o) => !o.fav);
    const shown = new Set([...favs, ...rec].map((o) => o.id));
    const rest = all.filter((o) => !shown.has(o.id)).slice(0, 40);
    return (section('Favoriten', favs.map(r)) + section('Zuletzt', rec.map(r)) + section(kind === 'foods' ? 'Gespeichert' : 'Alle', rest.map(r))) || `<p class="empty">${EMPTY[kind]}</p>`;
  }
  const hits = all.filter((o) => nameOf(o).includes(q) || (o.brand || '').toLowerCase().includes(q)).slice(0, 40).map(r);
  if (kind !== 'foods') return hits.join('') || '<p class="empty">Nichts gefunden.</p>';
  return section('Meine Lebensmittel', hits)
    + `<div class="fs-h">Open Food Facts</div><div class="fs-off">${q.length < 3 ? '<p class="empty">Ab 3 Buchstaben</p>' : '<div class="fs-wait">Sucht …</div>'}</div>`;
}

// Neu-Knöpfe je Art
function chipsHtml() {
  if (state.addKind === 'meals') return `<button type="button" class="chip" data-new="meal">${ICON.plus} Neue Mahlzeit</button>`;
  if (state.addKind === 'recipes') return `<button type="button" class="chip" data-new="recipe">${ICON.plus} Neues Rezept</button>`;
  return `<button type="button" class="chip" data-new="food">${ICON.plus} Neues Lebensmittel</button><button type="button" class="chip" data-new="quick">${ICON.flame} kcal direkt</button>`;
}

// ---------- Suchfenster ----------
// meal: vorgewählte Mahlzeit (Plus bei Frühstück … im Tagebuch), sonst nach Uhrzeit im Mengen-Fenster
export function openFoodSearch({ day = state.day || today(), meal = null } = {}) {
  Object.assign(ctx, { day, meal, q: '' });
  const sh = openSheet(`${sheetHead(meal ? `Eintragen · ${mealName(meal)}` : 'Eintragen', {})}
    <div class="seg-view fs-kinds">${KINDS.map(([k, l]) => `<button type="button" data-kind="${k}" class="${k === state.addKind ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="fs-bar">
      <label class="fs-search">${ICON.search}<input id="fs-q" type="search" autocomplete="off" enterkeyhint="search"></label>
      <button type="button" class="cbtn fs-scan" data-scan aria-label="Barcode scannen" title="Barcode scannen">${ICON.barcode}</button>
    </div>
    <div class="fs-quick" id="fs-chips"></div>
    <div class="fs-list" id="fs-list"></div>`, { full: true });

  const $q = sh.querySelector('#fs-q'), $list = sh.querySelector('#fs-list'), $chips = sh.querySelector('#fs-chips'), $scan = sh.querySelector('[data-scan]');
  const runOff = debounce(async (q) => {
    const seq = ++ctx.offSeq;
    try {
      // schon gespeicherte (gleicher Barcode) stehen oben bei „Meine Lebensmittel“
      const found = (await searchOff(q)).filter((f) => !state.foods.some((x) => x.barcode && x.barcode === f.barcode));
      if (seq !== ctx.offSeq) return;
      const box = $list.querySelector('.fs-off');
      if (box) box.innerHTML = found.length ? found.map((f) => row(f.id, f)).join('') : '<p class="empty">Nichts gefunden</p>';
    } catch {
      if (seq === ctx.offSeq) $list.querySelector('.fs-off')?.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'Open Food Facts nicht erreichbar' }));
    }
  }, 450);
  const draw = () => {
    const kind = state.addKind;
    $q.placeholder = KINDS.find(([k]) => k === kind)[2];
    $scan.hidden = kind !== 'foods';
    $chips.innerHTML = chipsHtml();
    $list.innerHTML = listHtml();
    ctx.offSeq++;
    if (kind === 'foods' && ctx.q.length >= 3) runOff(ctx.q);
  };

  $q.addEventListener('input', () => { ctx.q = clean($q.value, 80); draw(); });
  sh.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
    state.addKind = b.dataset.kind;
    store('addKind', state.addKind);
    sh.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  $list.addEventListener('click', async (e) => {
    const star = e.target.closest('[data-star]');
    if (star) {
      const key = star.dataset.star, obj = ctx.picks.get(key);
      if (!obj) return;
      star.disabled = true;
      if (key.startsWith('m:')) await saveMeal({ ...obj, fav: !obj.fav });
      else if (key.startsWith('r:')) await saveRecipe({ ...obj, fav: !obj.fav });
      else { const f = await keepFood(obj); await saveFood({ ...f, fav: !f.fav }); }   // Open Food Facts: wird dabei gespeichert
      if (key.startsWith('off:')) toast('Lebensmittel gespeichert');
      return draw();
    }
    const b = e.target.closest('[data-pick]'), key = b?.dataset.pick, obj = key && ctx.picks.get(key);
    if (!obj) return;
    if (key.startsWith('r:')) openAmount({ recipe: obj });
    else if (key.startsWith('m:')) openAmount({ meal: obj });
    else openAmount({ food: obj });
  });
  $chips.addEventListener('click', (e) => {
    const k = e.target.closest('[data-new]')?.dataset.new;
    if (k === 'food') openFoodEditor(null, { onSaved: (f) => openAmount({ food: f }) });
    if (k === 'quick') openQuick();
    if (k === 'meal') openMealEditor(null, { onSaved: (m) => openAmount({ meal: m }) });
    if (k === 'recipe') openRecipeEditor();
  });
  $scan.addEventListener('click', async () => {
    const code = await scanBarcode();
    if (code) findBarcode(code);
  });
  draw();
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

// ---------- Menge und Mahlzeit wählen (neu oder bestehender Eintrag) ----------
// Einheiten: Lebensmittel g/ml plus Portionen; Rezepte und Mahlzeiten Portionen (Werte je Portion)
export function openAmount({ food = null, recipe = null, meal = null, entry = null }) {
  if (entry) {
    recipe = entry.recipe_id ? recipeById(entry.recipe_id) : null;
    meal = entry.saved_meal_id ? mealById(entry.saved_meal_id) : null;
    food = entry.food_id ? foodById(entry.food_id) : null;
  }
  const portion = recipe ? (() => { const t = recipeTotals(recipe); return { per: t.per, g: t.grams / recipe.servings }; })()
    : meal ? { per: meal, g: meal.grams } : null;
  const units = portion ? [{ n: 'Portion', g: portion.g }] : food ? [{ n: food.unit, g: 1 }, ...food.portions] : [{ n: entry?.unit_label || 'g', g: 1 }];
  let unitIdx = entry ? Math.max(0, units.findIndex((u) => u.n === entry.unit_label)) : units.length > 1 ? 1 : 0;
  const isGrams = () => !portion && units[unitIdx].g === 1 && units[unitIdx].n === (food?.unit || 'g');
  const startAmount = entry ? entry.amount : isGrams() ? 100 : 1;
  let slot = entry ? entry.meal : ctx.meal || mealNow();
  const title = recipe ? recipe.title : meal ? meal.title : food ? food.name : entry?.name;
  const sub = food?.brand || (recipe ? 'Rezept' : meal ? 'Mahlzeit' : '');

  const sh = openSheet(`${sheetHead(entry ? 'Eintrag' : 'Menge', { save: true, del: !!entry, saveLabel: entry ? 'Speichern' : 'Hinzufügen' })}
    <div class="am-title"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
    <div class="seg-view fs-meals">${MEALS.map(([k, l]) => `<button type="button" data-slot="${k}" class="${k === slot ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="am-row">${stepper('am-n', startAmount, isGrams() ? 10 : 0.5)}
      <select id="am-u" class="select am-u" ${units.length < 2 ? 'disabled' : ''}>${units.map((u, i) => `<option value="${i}" ${i === unitIdx ? 'selected' : ''}>${esc(u.n)}${u.g && (u.g !== 1 || portion) ? ` (${fmt(u.g)} ${food?.unit || 'g'})` : ''}</option>`).join('')}</select></div>
    <div class="am-sum" id="am-sum"></div>
    ${entry?.planned ? '<label class="am-plan"><input type="checkbox" id="am-eaten"> Gegessen (aus dem Plan ins Tagebuch)</label>' : ''}`);

  const $n = sh.querySelector('#am-n'), $u = sh.querySelector('#am-u');
  const calc = () => {
    const amount = num($n.value, 0, 100000), grams = amount * (units[unitIdx].g || 0);
    const per = (k) => round(portion.per[k] * amount, 1);
    const v = portion ? { kcal: per('kcal'), protein: per('protein'), fat: per('fat'), carbs: per('carbs') }
      : food ? forGrams(food, grams)
        : { kcal: round(entry.kcal * amount / entry.amount, 1), protein: round(entry.protein * amount / entry.amount, 1), fat: round(entry.fat * amount / entry.amount, 1), carbs: round(entry.carbs * amount / entry.amount, 1) };
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
    $n.value = isGrams() ? '100' : '1';
    sh.querySelector('.stepper').dataset.step = isGrams() ? '10' : '0.5';
    show();
  });
  sh.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
    slot = b.dataset.slot;
    sh.querySelectorAll('[data-slot]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  show();

  sh.querySelector('[data-save]').addEventListener('click', async () => {
    const v = calc();
    if (!(v.amount > 0)) return toast('Bitte eine Menge eingeben.');
    const base = { meal: slot, amount: v.amount, unit_label: units[unitIdx].n, grams: v.grams, kcal: v.kcal, protein: v.protein, fat: v.fat, carbs: v.carbs };
    if (entry) {
      updateEntry(entry.id, { ...base, planned: entry.planned && !sh.querySelector('#am-eaten')?.checked });
    } else {
      const f = food ? await keepFood(food) : null;
      addEntries([{ id: uuid(), day: ctx.day || today(), name: title, food_id: f?.id || null, recipe_id: recipe?.id || null,
        saved_meal_id: meal?.id || null, planned: (ctx.day || today()) > today(), ...base }]);
      toast(`${mealName(slot)}: ${fmt(v.kcal)} kcal eingetragen`);
    }
    closeSheet();
  });
  sh.querySelector('[data-del]')?.addEventListener('click', () => { deleteEntries([entry.id]); closeSheet(); });
}

// ---------- kcal direkt (ohne Lebensmittel) ----------
function openQuick() {
  let slot = ctx.meal || mealNow();
  const sh = openSheet(`${sheetHead('kcal direkt', { save: true, saveLabel: 'Hinzufügen' })}
    <div class="field"><label for="q-n">Name</label><input id="q-n" class="input" placeholder="z. B. Kantine Mittag" maxlength="120"></div>
    <div class="seg-view fs-meals">${MEALS.map(([k, l]) => `<button type="button" data-slot="${k}" class="${k === slot ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="grid2">
      <div class="field"><label for="q-k">kcal</label><input id="q-k" class="input" inputmode="decimal"></div>
      ${MACROS.map(([k, l]) => `<div class="field"><label for="q-${k}">${l} (g)</label><input id="q-${k}" class="input" inputmode="decimal"></div>`).join('')}
    </div>`);
  sh.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
    slot = b.dataset.slot;
    sh.querySelectorAll('[data-slot]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  sh.querySelector('[data-save]').addEventListener('click', () => {
    const kcal = num(sh.querySelector('#q-k').value, 0, 20000);
    if (!kcal) return toast('Bitte kcal eingeben.');
    const m = Object.fromEntries(MACROS.map(([k]) => [k, num(sh.querySelector('#q-' + k).value, 0, 2000)]));
    addEntries([{ id: uuid(), day: ctx.day || today(), meal: slot, name: clean(sh.querySelector('#q-n').value, 120) || 'Schnell eingetragen', amount: 1, unit_label: 'Eintrag', grams: 0, kcal, ...m, planned: false }]);
    closeSheet();
  });
}
