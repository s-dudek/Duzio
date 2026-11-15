// Hauptansicht: Smartphone mit Kopfleiste und Leiste unten, Desktop mit Seitenleiste (wie in der Übersicht)
import { BRAND } from './auth.js';
import { ctl } from './control.js';
import { $app, esc, isDesktop, state } from './core.js';
import { dayLabel, today } from './dates.js';
import { renderDiary } from './diary.js';
import { homeBar, renderHome } from './home.js';
import { ICON, LOGO_MARK } from './icons.js';
import { NAV } from './nav.js';
import { renderProgress } from './progress.js';
import { renderRecipes } from './recipes.js';
import { openCount, renderShopping } from './shopping.js';
import { splashReady } from './splash.js';

const WATERMARK = `<div class="watermark" aria-hidden="true">${LOGO_MARK}</div>`;
const PAGES = { home: renderHome, diary: renderDiary, recipes: renderRecipes, shopping: renderShopping, progress: renderProgress };
const TITLES = { diary: 'Tagebuch', recipes: 'Rezepte', shopping: 'Einkauf', progress: 'Fortschritt' };

export function render() {
  if (!state.me || !state.loaded) return;
  const prevScroll = document.querySelector('.main')?.scrollTop || 0;
  const sameTab = render.lastTab === state.tab;
  render.lastTab = state.tab;
  const tab = state.tab, home = tab === 'home', desk = isDesktop();
  const content = (PAGES[tab] || renderHome)();
  const acts = actionsFor(tab);
  $app.innerHTML = desk
    ? `<div class="app desk">${WATERMARK}${sidebar(tab)}
        <div class="desk-main">${home ? '' : pageHead(tab, true)}<main class="main ${home ? 'is-home' : ''}">${content}</main></div></div>`
    : `<div class="app">${WATERMARK}${home ? homeBar() : pageHead(tab, false)}
        <main class="main ${home ? 'is-home' : acts ? 'has-dock' : ''}">${content}</main>
        ${home || !acts ? '' : `<nav class="dock" aria-label="Aktionen">${acts}</nav>`}</div>`;
  ctl.show(!desk && !home);
  if (sameTab) $app.querySelector('.main').scrollTop = prevScroll;
  splashReady();
}

// ---------- Desktop: Seitenleiste ----------
function sidebar(tab) {
  const count = { shopping: openCount() };
  const item = (n) => `<button class="sn ${n.key === tab ? 'on' : ''}" data-act="nav" data-id="${n.key}">${ICON[n.icon]}<span>${n.label}</span>${count[n.key] ? `<i>${count[n.key]}</i>` : ''}</button>`;
  return `<aside class="side">
    <div class="side-brand">${BRAND}</div>
    <button class="btn block side-new" data-act="nav" data-id="add">${ICON.plus} Eintragen</button>
    <nav class="side-nav">${NAV.filter((n) => n.key !== 'add').map(item).join('')}</nav>
    <div class="side-foot">
      <button class="sn" data-act="settings">${ICON.gear}<span>Profil & Ziele</span></button>
      <button class="sn out" data-act="logout">${ICON.power}<span>Abmelden</span></button>
    </div></aside>`;
}

// ---------- Aktionen je Bereich: Smartphone unten in der Leiste, Desktop rechts in der Kopfleiste ----------
export const actBtn = (act, icon, label, { id = '', primary = false, text = true } = {}) =>
  `<button class="dk ${primary ? 'pri' : ''}" data-act="${act}" ${id !== '' ? `data-id="${esc(id)}"` : ''} aria-label="${esc(label)}" title="${esc(label)}">${ICON[icon]}${text ? `<span>${esc(label)}</span>` : ''}</button>`;

function actionsFor(tab) {
  const day = state.day || today();
  if (tab === 'diary') {
    return `${actBtn('day', 'chevL', 'Tag zurück', { id: '-1', text: false })}<button class="dk wk-now" data-act="day" data-id="0"><span>${esc(dayLabel(day))}</span></button>${actBtn('day', 'chevR', 'Tag vor', { id: '1', text: false })}${actBtn('add', 'plus', 'Eintragen', { primary: true, text: isDesktop() })}`;
  }
  if (tab === 'recipes') {
    if (state.recipeFilter === 'foods') return actBtn('new-food', 'plus', 'Lebensmittel', { primary: true });
    if (state.recipeFilter === 'meals') return `${actBtn('import', 'copy', 'Code')}${actBtn('new-meal', 'plus', 'Mahlzeit', { primary: true })}`;
    return `${actBtn('import', 'copy', 'Code')}${actBtn('new-recipe', 'plus', 'Rezept', { primary: true })}`;
  }
  if (tab === 'shopping') return `${actBtn('shop-plan', 'calendar', 'Aus Plan')}${actBtn('shop-clear', 'trash', 'Erledigte löschen', { text: false })}`;
  if (tab === 'progress') return actBtn('weight', 'scale', 'Gewicht eintragen', { primary: true });
  return '';
}

function pageHead(tab, desk) {
  const tools = desk ? `<div class="ph-tools">${actionsFor(tab)}</div>` : '';
  const cnt = tab === 'shopping' ? `<span class="cnt ${openCount() ? '' : 'zero'}">${openCount()}</span>` : '';
  return `<header class="pagehead"><div class="ph-in"><b>${TITLES[tab]}</b>${cnt}${tools}</div></header>`;
}
