// Einkaufsliste: nach Abteilung gruppiert, abhaken, schnell hinzufügen;
// automatisch aus eingeplanten Rezepten/Lebensmitteln (Zeitraum wählen) oder aus einem Rezept
import { askConfirm, clean, esc, fmt, foodById, num, recipeById, state, toast, uuid } from './core.js';
import { AISLES, addShopping, deleteShopping, updateShopping } from './data.js';
import { addDays, dayLabel, isDay, today } from './dates.js';
import { ICON } from './icons.js';
import { closeSheet, openSheet, sheetHead } from './sheet.js';

export const openCount = () => state.shopping.filter((s) => !s.done).length;

// Abteilung aus dem Namen erraten (wie beim Hofer sortiert)
const GUESS = [
  ['Obst & Gemüse', /apfel|banane|beere|zitrone|orange|birne|traube|kiwi|mango|paradeis|tomate|gurke|salat|zwiebel|knoblauch|karotte|erdäpfel|kartoffel|paprika|zucchini|brokkoli|spinat|pilz|champignon|avocado|lauch|kraut|petersilie|schnittlauch|basilikum|ingwer|kohl|obst|gemüse/i],
  ['Brot & Backwaren', /brot|semmel|toast|wrap|tortilla|gebäck|weckerl|baguette|knäcke/i],
  ['Kühlregal', /milch|joghurt|skyr|topfen|quark|käse|butter|sahne|obers|rahm|ei(er)?\b|eier|cottage|mozzarella|feta|tofu|schinken|aufstrich/i],
  ['Fleisch & Fisch', /fleisch|huhn|hühner|hähnchen|pute|rind|schwein|faschiert|hack|lachs|thunfisch|fisch|garnele|speck|wurst/i],
  ['Tiefkühl', /tiefkühl|tk-|gefroren|eis\b/i],
  ['Trockenware & Konserven', /nudel|pasta|reis|mehl|zucker|haferflocken|müsli|linsen|bohnen|kichererbsen|dose|konserve|passata|couscous|quinoa|grieß|nüsse|mandel|samen|kakao|protein/i],
  ['Gewürze & Öle', /salz|pfeffer|öl\b|olivenöl|essig|gewürz|paprikapulver|curry|zimt|oregano|senf|ketchup|sojasauce|honig/i],
  ['Getränke', /wasser|saft|kaffee|tee\b|bier|wein|limo|cola/i],
  ['Süßes & Snacks', /schoko|keks|chips|riegel|gummi|süß/i],
  ['Drogerie & Haushalt', /spül|wasch|papier|seife|shampoo|zahn|müllsack|folie/i],
];
export const guessAisle = (name) => GUESS.find(([, re]) => re.test(name))?.[0] || 'Sonstiges';

// Menge vereinheitlichen: kg -> g, l -> ml
function normUnit(qty, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'kg') return [qty * 1000, 'g'];
  if (u === 'l') return [qty * 1000, 'ml'];
  return [qty, unit || ''];
}
export const qtyText = (s) => {
  if (s.qty == null) return '';
  if (s.unit === 'g' && s.qty >= 1000) return `${fmt(s.qty / 1000, 2)} kg`;
  if (s.unit === 'ml' && s.qty >= 1000) return `${fmt(s.qty / 1000, 2)} l`;
  return `${fmt(s.qty, s.unit === 'g' || s.unit === 'ml' ? 0 : 1)} ${s.unit}`.trim();
};

// Einträge in die Liste übernehmen: gleiche offene Zeilen (Name + Einheit) werden zusammengezählt
export function mergeIntoShopping(items) {
  const fresh = [];
  for (const it of items) {
    const name = clean(it.name);
    if (!name) continue;
    const [qty, unit] = it.qty == null ? [null, ''] : normUnit(num(it.qty, 0, 1e5), it.unit);
    const same = state.shopping.find((s) => !s.done && s.name.toLowerCase() === name.toLowerCase() && (s.unit || '') === unit)
      || fresh.find((s) => s.name.toLowerCase() === name.toLowerCase() && (s.unit || '') === unit);
    if (same && qty != null) {
      if (fresh.includes(same)) same.qty = (same.qty || 0) + qty;
      else updateShopping(same.id, { qty: (same.qty || 0) + qty });
    } else if (!same) {
      fresh.push({ id: uuid(), name, qty, unit, aisle: AISLES.includes(it.aisle) && it.aisle !== 'Sonstiges' ? it.aisle : guessAisle(name), done: false });
    }
  }
  if (fresh.length) addShopping(fresh);
  return items.length;
}

// Zutaten eines Rezepts für eine Anzahl Portionen
export function recipeItems(r, portions = r.servings) {
  const f = portions / r.servings;
  return r.ingredients.map((i) => ({ name: i.name, qty: i.g ? Math.round(i.g * f) : null, unit: i.g ? 'g' : '', aisle: i.aisle }));
}

// „500 g Mehl“, „2 Paradeiser“, „Milch“
function parseLine(t) {
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|stk\.?|stück|el|tl|pkg\.?|packung|dose|bund)?\s+(.+)$/i);
  return m ? { name: m[3], qty: num(m[1]), unit: (m[2] || '').replace(/\.$/, '') } : { name: t, qty: null, unit: '' };
}

// ---------- Seite ----------
export function renderShopping() {
  const open = state.shopping.filter((s) => !s.done), done = state.shopping.filter((s) => s.done);
  const row = (s) => `<div class="sh-row ${s.done ? 'done' : ''}">
    <button class="tcheck ${s.done ? 'on' : ''}" data-act="shop-toggle" data-id="${esc(s.id)}" aria-label="${s.done ? 'Wieder offen' : 'Abhaken'}">${ICON.check}</button>
    <span class="sh-n">${esc(s.name)}</span><span class="sh-q">${esc(qtyText(s))}</span>
    <button class="lgear" data-act="shop-del" data-id="${esc(s.id)}" aria-label="Entfernen">${ICON.close}</button></div>`;
  const groups = AISLES.map((a) => [a, open.filter((s) => s.aisle === a)]).filter(([, l]) => l.length);
  return `<form class="card addrow" id="shop-add"><span class="mt-ic">${ICON.plus}</span>
      <input name="t" placeholder="z. B. 500 g Mehl" maxlength="160" autocomplete="off" enterkeyhint="done" aria-label="Zur Einkaufsliste hinzufügen"></form>
    ${groups.length ? groups.map(([a, l]) => `<section class="card sh-group"><div class="fs-h">${esc(a)}</div>${l.map(row).join('')}</section>`).join('')
      : '<p class="empty">Alles erledigt. Mit „Aus Plan“ entsteht die Liste aus deinen eingeplanten Gerichten.</p>'}
    ${done.length ? `<section class="card sh-group"><div class="fs-h">Erledigt</div>${done.map(row).join('')}</section>` : ''}`;
}

export function shopSubmit(form) {
  const t = clean(form.querySelector('input').value);
  if (!t) return;
  mergeIntoShopping([parseLine(t)]);
  requestAnimationFrame(() => document.querySelector('#shop-add input')?.focus());
}

export function toggleShop(id) {
  const s = state.shopping.find((x) => x.id === id);
  if (s) updateShopping(id, { done: !s.done });
}

export async function clearDone() {
  const ids = state.shopping.filter((s) => s.done).map((s) => s.id);
  if (!ids.length) return toast('Nichts erledigt.');
  if (await askConfirm(`${ids.length} erledigte Einträge löschen?`, 'Löschen')) deleteShopping(ids);
}

// ---------- Aus dem Plan: alle eingeplanten Einträge eines Zeitraums ----------
function planItems(from, to) {
  const out = [];
  for (const e of state.entries) {
    if (!e.planned || e.day < from || e.day > to) continue;
    const r = e.recipe_id && recipeById(e.recipe_id);
    if (r) out.push(...recipeItems(r, e.unit_label === 'Portion' ? e.amount : r.servings));
    else {
      const f = e.food_id && foodById(e.food_id);
      out.push({ name: e.name, qty: Math.round(e.grams) || null, unit: e.grams ? f?.unit || 'g' : '', aisle: guessAisle(e.name) });
    }
  }
  return out;
}

export function openPlanToShopping() {
  const t = today();
  const sh = openSheet(`${sheetHead('Aus dem Plan', { save: true, saveLabel: 'Auf die Liste' })}
    <div class="grid2">
      <div class="field"><label for="pl-from">Von</label><input id="pl-from" type="date" class="input" value="${t}"></div>
      <div class="field"><label for="pl-to">Bis</label><input id="pl-to" type="date" class="input" value="${addDays(t, 6)}"></div>
    </div>
    <div id="pl-prev"></div>`);
  const range = () => {
    const from = sh.querySelector('#pl-from').value, to = sh.querySelector('#pl-to').value;
    return isDay(from) && isDay(to) ? [from, to] : [t, t];
  };
  const preview = () => {
    const [from, to] = range(), items = planItems(from, to);
    const days = new Set(state.entries.filter((e) => e.planned && e.day >= from && e.day <= to).map((e) => e.day));
    sh.querySelector('#pl-prev').innerHTML = items.length
      ? `<p class="muted">${items.length} Zutaten aus ${days.size} Tag${days.size === 1 ? '' : 'en'} (${esc(dayLabel(from))} – ${esc(dayLabel(to))})</p>
        <div class="pl-list">${items.map((i) => `<span>${esc(i.name)}<small>${esc(qtyText(i))}</small></span>`).join('')}</div>`
      : '<p class="empty">In diesem Zeitraum ist nichts eingeplant. Rezepte oder Lebensmittel an zukünftigen Tagen eintragen, dann landen sie hier.</p>';
  };
  sh.querySelectorAll('input[type=date]').forEach((i) => i.addEventListener('change', preview));
  preview();
  sh.querySelector('[data-save]').addEventListener('click', () => {
    const items = planItems(...range());
    if (!items.length) return toast('Nichts eingeplant.');
    mergeIntoShopping(items);
    closeSheet();
    toast(`${items.length} Zutaten auf der Einkaufsliste`);
  });
}
