// Tagebuch: Tag mit kcal-Ring und Makros, Mahlzeiten mit Einträgen, Wasser. Geplantes (Zukunft bzw. aus dem Plan) extra.
import { esc, fmt, state } from './core.js';
import { today } from './dates.js';
import { ICON } from './icons.js';
import { MEALS, entriesOn, goals, sum } from './nutri.js';
import { kcalRing, macroBars, waterGlasses } from './widgets.js';

export const diaryDay = () => state.day || today();

function entryRow(e) {
  const amount = e.unit_label === 'Eintrag' ? '' : `${fmt(e.amount, 1)} ${esc(e.unit_label)}`;
  return `<button class="en ${e.planned ? 'planned' : ''}" data-act="entry" data-id="${esc(e.id)}">
    <span class="en-t"><b>${esc(e.name)}</b><small>${amount}${e.planned ? `${amount ? ' · ' : ''}geplant` : ''}</small></span>
    <span class="en-k">${fmt(e.kcal)}<small> kcal</small></span></button>`;
}

function mealCard([key, label, icon], day, g) {
  const eaten = entriesOn(day).filter((e) => e.meal === key);
  const planned = entriesOn(day, { planned: true }).filter((e) => e.meal === key);
  const t = sum(eaten);
  // Anteil am Tagesziel als Richtwert (Frühstück 25 %, Mittag 35 %, Abend 30 %, Snacks 10 %)
  const share = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 }[key];
  return `<section class="card meal">
    <div class="meal-h">
      <span class="mt-ic">${ICON[icon]}</span>
      <span class="meal-t"><b>${label}</b><small>${fmt(t.kcal)} / ${fmt(g.kcal * share)} kcal</small></span>
      <button class="cbtn" data-act="add" data-id="${key}" aria-label="${label} eintragen" title="Eintragen">${ICON.plus}</button>
    </div>
    ${eaten.length || planned.length ? `<div class="en-list">${eaten.map(entryRow).join('')}${planned.map(entryRow).join('')}</div>` : ''}
  </section>`;
}

export function renderDiary() {
  const day = diaryDay(), g = goals(), t = sum(entriesOn(day)), ml = state.water[day] || 0;
  return `<section class="card day-sum">
      <div class="ds-col"><b>${fmt(t.kcal)}</b><small>gegessen</small></div>
      ${kcalRing(t.kcal, g.kcal)}
      <div class="ds-col"><b>${fmt(g.kcal)}</b><small>Ziel</small></div>
      ${macroBars(t, g)}
    </section>
    <div class="meals">${MEALS.map((m) => mealCard(m, day, g)).join('')}</div>
    <section class="card water">
      <div class="meal-h">
        <span class="mt-ic water-ic">${ICON.drop}</span>
        <span class="meal-t"><b>Wasser</b><small>${fmt(ml / 1000, 2)} / ${fmt(g.water / 1000, 1)} l</small></span>
        <button class="cbtn light" data-act="water" data-id="-250" aria-label="250 ml weniger">${ICON.minus}</button>
        <button class="cbtn" data-act="water" data-id="250" aria-label="250 ml mehr">${ICON.plus}</button>
      </div>
      ${waterGlasses(ml, g.water)}
    </section>`;
}
