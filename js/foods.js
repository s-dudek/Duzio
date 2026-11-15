// Lebensmittel anlegen und bearbeiten (Werte je 100 g bzw. 100 ml) und Liste „Meine Lebensmittel“
import { askConfirm, clean, esc, fmt, foodById, num, state, toast, uuid } from './core.js';
import { deleteFood, saveFood } from './data.js';
import { ICON } from './icons.js';
import { MACROS } from './nutri.js';
import { closeSheet, openSheet, sheetHead } from './sheet.js';

const EXTRA = [['sugar', 'davon Zucker'], ['fiber', 'Ballaststoffe'], ['salt', 'Salz']];

// Portionen als Text: je Zeile „Name = Gramm“
const portionsText = (p) => p.map((x) => `${x.n} = ${fmt(x.g, 1)}`).join('\n');
const parsePortions = (t) => t.split('\n').map((l) => {
  const [n, g] = l.split('=');
  return { n: clean(n, 40), g: num(g, 0, 5000) };
}).filter((p) => p.n && p.g > 0).slice(0, 12);

export function openFoodEditor(food, { onSaved = null } = {}) {
  const f = { name: '', brand: '', barcode: '', unit: 'g', kcal: '', protein: '', fat: '', carbs: '', sugar: '', fiber: '', salt: '', portions: [], fav: false, ...(food || {}) };
  const isNew = !f.id || String(f.id).startsWith('off:');
  const val = (v) => (v == null ? '' : esc(v));
  const sh = openSheet(`${sheetHead(isNew ? 'Neues Lebensmittel' : 'Lebensmittel', { save: true, del: !isNew })}
    <div class="field"><label for="fe-name">Name</label><input id="fe-name" class="input" maxlength="160" value="${val(f.name)}" placeholder="z. B. Skyr Natur"></div>
    <div class="grid2">
      <div class="field"><label for="fe-brand">Marke</label><input id="fe-brand" class="input" maxlength="120" value="${val(f.brand)}"></div>
      <div class="field"><label for="fe-bc">Barcode</label><input id="fe-bc" class="input" inputmode="numeric" maxlength="14" value="${val(f.barcode)}"></div>
    </div>
    <div class="field"><label>Nährwerte je 100</label>
      <div class="seg-view fe-unit">${['g', 'ml'].map((u) => `<button type="button" data-unit="${u}" class="${f.unit === u ? 'on' : ''}">${u}</button>`).join('')}</div></div>
    <div class="grid2">
      <div class="field"><label for="fe-kcal">kcal</label><input id="fe-kcal" class="input" inputmode="decimal" value="${val(f.kcal)}"></div>
      ${MACROS.map(([k, l]) => `<div class="field"><label for="fe-${k}">${l} (g)</label><input id="fe-${k}" class="input" inputmode="decimal" value="${val(f[k])}"></div>`).join('')}
      ${EXTRA.map(([k, l]) => `<div class="field"><label for="fe-${k}">${l} (g)</label><input id="fe-${k}" class="input" inputmode="decimal" value="${val(f[k])}"></div>`).join('')}
    </div>
    <div class="field"><label for="fe-por">Portionen (je Zeile „Name = Menge“)</label>
      <textarea id="fe-por" class="textarea small" placeholder="Stück = 60&#10;Becher = 150">${esc(portionsText(f.portions))}</textarea></div>`);

  let unit = f.unit;
  sh.querySelectorAll('[data-unit]').forEach((b) => b.addEventListener('click', () => {
    unit = b.dataset.unit;
    sh.querySelectorAll('[data-unit]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  const v = (id) => sh.querySelector('#fe-' + id).value;
  const opt = (id) => (v(id).trim() === '' ? null : num(v(id), 0, 100));

  sh.querySelector('[data-save]').addEventListener('click', async () => {
    const name = clean(v('name'));
    if (!name) return toast('Bitte einen Namen eingeben.');
    const kcal = num(v('kcal'), 0, 1000), macros = Object.fromEntries(MACROS.map(([k]) => [k, num(v(k), 0, 100)]));
    if (macros.protein + macros.fat + macros.carbs > 100) return toast('Eiweiß, Fett und Kohlenhydrate ergeben mehr als 100 g.');
    const bc = v('bc').replace(/\D/g, '');
    const saved = {
      id: isNew ? uuid() : f.id, name, brand: clean(v('brand'), 120), barcode: /^\d{6,14}$/.test(bc) ? bc : null, unit, kcal, ...macros,
      sugar: opt('sugar'), fiber: opt('fiber'), salt: opt('salt'), portions: parsePortions(v('por')), source: isNew ? 'own' : f.source, fav: f.fav,
    };
    await saveFood(saved);
    closeSheet();
    onSaved?.(foodById(saved.id));
  });
  sh.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await askConfirm('Lebensmittel löschen?', 'Löschen', 'Einträge im Tagebuch bleiben erhalten.'))) return;
    deleteFood(f.id);
    closeSheet();
  });
}

// Liste „Meine Lebensmittel“ (Bereich Rezepte, Umschalter oben)
export function foodListHtml(q = '') {
  const s = q.toLowerCase();
  const list = state.foods.filter((f) => !s || f.name.toLowerCase().includes(s) || (f.brand || '').toLowerCase().includes(s));
  if (!list.length) return `<p class="empty">${s ? 'Nichts gefunden.' : 'Noch keine Lebensmittel. Beim Eintragen aus Open Food Facts werden sie hier gemerkt.'}</p>`;
  return `<div class="card list-card">${list.map((f) => `<button class="fr" data-act="food" data-id="${esc(f.id)}">
    <span class="fr-ic ${f.source === 'off' ? 'off' : ''}">${ICON[f.fav ? 'star' : 'leaf']}</span>
    <span class="fr-t"><b>${esc(f.name)}</b><small>${f.brand ? esc(f.brand) + ' · ' : ''}${fmt(f.kcal)} kcal · E ${fmt(f.protein, 1)} · F ${fmt(f.fat, 1)} · K ${fmt(f.carbs, 1)} / 100 ${f.unit}</small></span>
    ${ICON.chevR}</button>`).join('')}</div>`;
}
