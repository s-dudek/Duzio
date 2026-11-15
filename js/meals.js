// Mahlzeiten: gespeicherte Zusammenfassung – Name, Nährwerte je Portion, Bestandteile als kurze Liste.
// Anlegen von Hand (Bestandteile aus Lebensmitteln zählen die Werte zusammen) oder aus einem Rezept umgewandelt.
import { askConfirm, clean, esc, fmt, mealById, num, round, state, toast, uuid } from './core.js';
import { deleteMeal, saveMeal } from './data.js';
import { openAmount } from './food-search.js';
import { ICON } from './icons.js';
import { MACROS, forGrams, recipeTotals } from './nutri.js';
import { pickerHtml, wirePicker } from './picker.js';
import { macroLine, openRecipe } from './recipes.js';
import { closeSheet, openSheet, sheetHead } from './sheet.js';

const NUTR = [['kcal', 'kcal'], ...MACROS.map(([k, l]) => [k, `${l} (g)`])];

// Liste im Bereich Rezepte (Umschalter „Mahlzeiten“)
export function mealListHtml(q = '') {
  const s = q.toLowerCase();
  const list = state.meals.filter((m) => !s || m.title.toLowerCase().includes(s)).sort((a, b) => b.fav - a.fav || a.title.localeCompare(b.title, 'de'));
  if (!list.length) return `<p class="empty">${s ? 'Nichts gefunden.' : 'Noch keine Mahlzeiten. Lege eine an oder wandle ein Rezept um.'}</p>`;
  return `<div class="rgrid">${list.map((m) => `<button class="card rc" data-act="meal" data-id="${esc(m.id)}">
    <span class="rc-h"><b>${esc(m.title)}</b>${m.fav ? `<span class="rc-fav">${ICON.star}</span>` : ''}</span>
    <span class="rc-k"><b>${fmt(m.kcal)}</b> kcal / Portion${m.grams ? ` · ${fmt(m.grams)} g` : ''}</span>
    <span class="mline">${macroLine(m)}</span>
    ${m.items.length ? `<span class="rc-items">${m.items.map((i) => esc(i.name)).join(' · ')}</span>` : ''}</button>`).join('')}</div>`;
}

// ---------- Ansicht ----------
export function openMeal(id) {
  const m = mealById(id);
  if (!m) return;
  const src = m.recipe_id && state.recipes.some((r) => r.id === m.recipe_id);
  const sh = openSheet(`${sheetHead(m.title, { edit: true, del: true })}
    <div class="rv-top"><div class="rv-k"><b>${fmt(m.kcal)}</b><small>kcal je Portion${m.grams ? ` (${fmt(m.grams)} g)` : ''}</small></div>
      <div class="mline big">${macroLine(m)}</div></div>
    <div class="rv-acts">
      <button class="btn" data-mv="diary">${ICON.diary} Ins Tagebuch</button>
      ${src ? `<button class="btn secondary" data-mv="recipe">${ICON.book} Zum Rezept</button>` : ''}
      <button class="chip ${m.fav ? 'on' : ''}" data-mv="fav">${ICON.star} Favorit</button>
    </div>
    ${m.items.length ? `<div class="rv-h"><b>Bestandteile</b></div>
      <ul class="rv-ing">${m.items.map((i) => `<li><span>${esc(i.name)}</span><b>${esc(i.label)}</b></li>`).join('')}</ul>` : ''}`);
  sh.querySelector('[data-mv="diary"]').addEventListener('click', () => openAmount({ meal: m }));
  sh.querySelector('[data-mv="recipe"]')?.addEventListener('click', () => openRecipe(m.recipe_id));
  sh.querySelector('[data-mv="fav"]').addEventListener('click', () => { saveMeal({ ...m, fav: !m.fav }); openMeal(id); });
  sh.querySelector('[data-edit]').addEventListener('click', () => openMealEditor(m));
  sh.querySelector('[data-del]').addEventListener('click', async () => {
    if (!(await askConfirm('Mahlzeit löschen?', 'Löschen', 'Einträge im Tagebuch bleiben erhalten.'))) return;
    deleteMeal(id);
    closeSheet();
  });
}

// ---------- Rezept -> Mahlzeit (eine Portion; gibt es schon eine aus diesem Rezept, wird sie aktualisiert) ----------
export function recipeToMeal(r) {
  const { per, grams } = recipeTotals(r), f = 1 / r.servings;
  const old = state.meals.find((m) => m.recipe_id === r.id);
  const meal = {
    id: old?.id || uuid(), title: r.title, grams: round(grams * f), recipe_id: r.id, fav: old?.fav || false,
    kcal: round(per.kcal, 1), protein: round(per.protein, 1), fat: round(per.fat, 1), carbs: round(per.carbs, 1),
    items: r.ingredients.map((i) => ({ name: i.name, label: i.g ? `${fmt(round(i.g * f))} g` : i.label })),
  };
  saveMeal(meal);
  toast(old ? 'Mahlzeit aktualisiert' : 'Als Mahlzeit gespeichert');
  openMeal(meal.id);
}

// ---------- Bearbeiten ----------
export function openMealEditor(meal = null, { onSaved = null } = {}) {
  const m = meal ? structuredClone(meal) : { id: uuid(), title: '', grams: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, items: [], recipe_id: null, fav: false };
  const v = (x) => (x ? esc(round(x, 1)) : '');
  const sh = openSheet(`${sheetHead(meal ? 'Mahlzeit bearbeiten' : 'Neue Mahlzeit', { save: true })}
    <input id="me-title" class="title-input" placeholder="Name, z. B. Frühstück Skyr-Bowl" maxlength="160" value="${esc(m.title)}">
    <div class="field"><label>Bestandteile</label>
      <div id="me-items"></div>
      <div id="me-add"></div>
      <div id="me-pk">${pickerHtml('Lebensmittel hinzufügen oder Namen + Enter')}</div></div>
    <div class="field"><label>Je Portion</label><div class="grid2">
      <div class="field"><label for="me-grams">Gewicht (g)</label><input id="me-grams" class="input" inputmode="decimal" value="${v(m.grams)}"></div>
      ${NUTR.map(([k, l]) => `<div class="field"><label for="me-${k}">${l}</label><input id="me-${k}" class="input" inputmode="decimal" value="${v(m[k])}"></div>`).join('')}
    </div></div>`, { full: true });

  const $items = sh.querySelector('#me-items'), $add = sh.querySelector('#me-add');
  const field = (k) => sh.querySelector('#me-' + k);
  const drawItems = () => {
    $items.innerHTML = m.items.length ? m.items.map((i, k) => `<div class="pg-row"><span>${esc(i.name)}</span><b>${esc(i.label)}</b>
      <button type="button" class="lgear" data-rm="${k}" aria-label="Entfernen">${ICON.close}</button></div>`).join('') : '';
  };
  $items.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (b) { m.items.splice(Number(b.dataset.rm), 1); drawItems(); }
  });

  // Lebensmittel mit Nährwerten: Menge abfragen, dann zu den Werten der Portion dazuzählen
  const ask = (f) => {
    const g0 = f.portions?.[0]?.g || 100;
    $add.innerHTML = `<div class="me-pend"><span class="re-n"><b>${esc(f.name)}</b><small>${fmt(f.kcal)} kcal / 100 ${f.unit}</small></span>
      <input class="input re-g" inputmode="decimal" value="${g0}" aria-label="Menge"><span class="re-u">${f.unit}</span>
      <button type="button" class="cbtn" data-ok aria-label="Dazuzählen">${ICON.check}</button></div>`;
    const $g = $add.querySelector('input');
    $g.focus();
    $g.select();
    const ok = () => {
      const g = num($g.value, 0, 10000);
      if (!g) return;
      const add = forGrams(f, g);
      for (const [k] of NUTR) field(k).value = String(round(num(field(k).value, 0, 10000) + add[k], 1));
      field('grams').value = String(round(num(field('grams').value, 0, 10000) + g));
      m.items.push({ name: f.name, label: `${fmt(g)} ${f.unit}` });
      $add.innerHTML = '';
      drawItems();
    };
    $add.querySelector('[data-ok]').addEventListener('click', ok);
    $g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
  };
  wirePicker(sh.querySelector('#me-pk'), (f) => {
    if (f.id) return ask(f);
    m.items.push({ name: f.name, label: '' });   // nur Name: Werte trägst du unten selbst ein
    drawItems();
  });
  drawItems();

  sh.querySelector('[data-save]').addEventListener('click', () => {
    const title = clean(field('title').value);
    if (!title) return toast('Bitte einen Namen eingeben.');
    const vals = Object.fromEntries(NUTR.map(([k]) => [k, num(field(k).value, 0, k === 'kcal' ? 10000 : 1000)]));
    if (!vals.kcal) return toast('Bitte die kcal je Portion eintragen.');
    const saved = { ...m, title, grams: num(field('grams').value, 0, 10000), ...vals };
    saveMeal(saved);
    closeSheet();
    if (onSaved) onSaved(mealById(saved.id)); else openMeal(saved.id);
  });
}
