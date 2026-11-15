// Lebensmittel auswählen in Editoren (Rezept-Zutaten, Mahlzeit-Bestandteile):
// eigene Lebensmittel sofort, Open Food Facts nach kurzer Pause; Enter übernimmt den getippten Namen ohne Nährwerte.
import { clean, debounce, esc, fmt, state } from './core.js';
import { ICON } from './icons.js';
import { searchOff } from './off.js';

export const pickerHtml = (placeholder) => `<div class="fs-search re-find">${ICON.search}<input type="search" class="pk-q" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="${esc(placeholder)}"></div>
  <div class="re-res pk-res"></div>`;

// root: Element mit pickerHtml; onPick(food) bzw. onPick({ name }) bei Enter
export function wirePicker(root, onPick) {
  const $q = root.querySelector('.pk-q'), $res = root.querySelector('.pk-res');
  const picks = new Map();
  let seq = 0;
  const row = (f) => {
    picks.set(f.id, f);
    return `<button type="button" class="fr small" data-pk="${esc(f.id)}"><span class="fr-t"><b>${esc(f.name)}</b><small>${f.brand ? esc(f.brand) + ' · ' : ''}${fmt(f.kcal)} kcal / 100 ${f.unit}</small></span><span class="fr-add">${ICON.plus}</span></button>`;
  };
  const own = (q) => state.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6).map(row).join('');
  const reset = () => { $q.value = ''; $res.innerHTML = ''; picks.clear(); seq++; };
  const off = debounce(async (q) => {
    const my = ++seq;
    try {
      const found = await searchOff(q);
      if (my === seq && clean($q.value, 80) === q) $res.innerHTML = own(q) + found.slice(0, 10).map(row).join('');
    } catch { /* Open Food Facts nicht erreichbar: eigene bleiben stehen */ }
  }, 500);

  $q.addEventListener('input', () => {
    const q = clean($q.value, 80);
    picks.clear();
    $res.innerHTML = q ? own(q) : '';
    if (q.length >= 3) off(q); else seq++;
  });
  $q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const name = clean($q.value);
    if (name) { reset(); onPick({ name }); }
  });
  $res.addEventListener('click', (e) => {
    const f = picks.get(e.target.closest('[data-pk]')?.dataset.pk);
    if (f) { reset(); onPick(f); }
  });
}
