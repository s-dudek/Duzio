// Startseite: Kacheln wie in der Übersicht (Widgets) – Heute (kcal-Ring), Makros, Wasser, Gewicht, Woche, Einkauf, Rezepte
import { BRAND } from './auth.js';
import { esc, fmt, isDesktop, state } from './core.js';
import { addDays, mondayOf, parseYmd, today } from './dates.js';
import { ICON } from './icons.js';
import { entriesOn, goals, latestWeight, recipeTotals, sum, totalsOn } from './nutri.js';
import { kcalRing, macroBars } from './widgets.js';

// Kachel-Rahmen: Akzentfarbe, Symbol im Farbkreis, Titel; Größe s/m/l wie in der Übersicht
const tile = ({ size, accent, icon, label, act, id = '', badge = '', body, cls = '' }) =>
  `<div class="mt sz-${size} ${cls}" style="--ac:${accent}" role="button" tabindex="0" data-act="${act}" ${id ? `data-id="${esc(id)}"` : ''}>
    <span class="mt-h"><span class="mt-ic">${ICON[icon]}</span><span>${label}</span></span>${badge ? `<i>${badge}</i>` : ''}${body}</div>`;

const stat = (big, sub, word = false) => `<span class="mt-stat ${word ? 'word' : ''}"><b>${big}</b><small>${sub}</small></span>`;

// Datum: dunkle Kachel mit großem Tag (wie in der Übersicht)
function dateTile() {
  const d = new Date();
  return `<div class="mt mt-date sz-s" role="button" tabindex="0" data-act="nav" data-id="diary">
    <div class="md-top"><span class="md-wd">${d.toLocaleDateString('de-AT', { weekday: 'long' })}</span></div>
    <span class="md-day">${d.getDate()}</span><span class="md-month">${d.toLocaleDateString('de-AT', { month: 'long' })}</span></div>`;
}

// Woche Mo–So: Balken je Tag (kcal im Verhältnis zum Ziel)
function weekBars(g) {
  const mon = mondayOf(today()), t = today();
  return `<span class="wbars">${Array.from({ length: 7 }, (_, k) => {
    const d = addDays(mon, k), kcal = totalsOn(d).kcal, h = Math.min(100, (kcal / g.kcal) * 100);
    return `<span class="${d === t ? 'now' : ''} ${kcal > g.kcal ? 'over' : ''}"><i style="height:${h.toFixed(0)}%"></i><small>${parseYmd(d).toLocaleDateString('de-AT', { weekday: 'narrow' })}</small></span>`;
  }).join('')}</span>`;
}

export function renderHome() {
  const day = today(), g = goals(), t = sum(entriesOn(day)), ml = state.water[day] || 0;
  const kg = latestWeight(), open = state.shopping.filter((s) => !s.done);
  const favs = [...state.recipes].sort((a, b) => b.fav - a.fav || b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  const desk = isDesktop();
  const tiles = [
    dateTile(),
    tile({ size: 'l', accent: '#4E7569', icon: 'flame', label: 'Heute', act: 'nav', id: 'diary', cls: 'mt-today',
      body: `<div class="td-body">${kcalRing(t.kcal, g.kcal)}<div class="td-side"><span><b>${fmt(t.kcal)}</b><small>gegessen</small></span><span><b>${fmt(g.kcal)}</b><small>Ziel</small></span></div></div>${macroBars(t, g, { compact: true })}` }),
    tile({ size: 's', accent: '#3E7CA8', icon: 'drop', label: 'Wasser', act: 'water', id: '250', body: stat(fmt(ml / 1000, 2), `von ${fmt(g.water / 1000, 1)} l Wasser`) }),
    tile({ size: 's', accent: '#76907F', icon: 'scale', label: 'Gewicht', act: 'nav', id: 'progress', body: stat(kg ? fmt(kg, 1) : '–', 'kg Gewicht') }),
    tile({ size: 'm', accent: '#D9873E', icon: 'chart', label: 'Diese Woche', act: 'nav', id: 'progress', body: weekBars(g) }),
    tile({ size: 's', accent: '#3E7CA8', icon: 'meat', label: 'Eiweiß', act: 'nav', id: 'diary', body: stat(fmt(t.protein), `von ${fmt(g.protein)} g Eiweiß`) }),
    tile({ size: 'm', accent: '#7FA08A', icon: 'cart', label: 'Einkauf', act: 'nav', id: 'shopping', badge: open.length || '',
      body: open.length ? `<ul class="mt-list">${open.slice(0, desk ? 8 : 4).map((s) => `<li>${esc(s.name)}</li>`).join('')}</ul>` : '<span class="mt-foot">Liste ist leer</span>' }),
    tile({ size: 'm', accent: '#7A5AA6', icon: 'book', label: 'Rezepte', act: 'nav', id: 'recipes', cls: 'mt-wide', badge: state.recipes.length || '',
      body: favs.length ? `<ul class="mt-list">${favs.slice(0, desk ? 8 : 4).map((r) => `<li>${esc(r.title)} · ${fmt(recipeTotals(r).per.kcal)} kcal</li>`).join('')}</ul>` : '<span class="mt-foot">Noch keine Rezepte</span>' }),
  ];
  return `<div class="dash-wrap"><div class="mtiles">${tiles.join('')}</div></div>`;
}

// Smartphone/Tablet: Leiste oben – Logo, Eintragen (rund), Profil, Abmelden
export function homeBar() {
  return `<header class="homebar"><div class="hbar-in">
    <span class="hbar-logo">${BRAND}</span>
    <button class="hbar-new" data-act="add" aria-label="Eintragen" title="Eintragen">${ICON.plus}</button>
    <span class="th-sp"></span>
    <button class="hbar-ic" data-act="settings" aria-label="Profil & Ziele" title="Profil & Ziele">${ICON.gear}</button>
    <button class="hbar-ic" data-act="logout" aria-label="Abmelden" title="Abmelden">${ICON.power}</button>
  </div></header>`;
}
