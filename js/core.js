// Grundlagen: Konfiguration, Supabase-Verbindung, Zustand und kleine Helfer
import { createClient } from './vendor/supabase.js';

export const cfg = window.APP_CONFIG || {};
export const $app = document.getElementById('app');
export const $sheetRoot = document.getElementById('sheet-root');
const $toast = document.getElementById('toast');

// Alles aus der Datenbank oder aus Open Food Facts vor der Anzeige maskieren
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Zahl prüfen und begrenzen (Eingaben, Datenbank, Open Food Facts)
export function num(v, min = 0, max = 1e6, fallback = 0) {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
// Text kürzen und von Steuerzeichen befreien (multiline: Zeilenumbrüche bleiben)
export const clean = (s, max = 160, multiline = false) =>
  String(s ?? '').replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
export const round = (n, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };
export const fmt = (n, d = 0) => round(n, d).toLocaleString('de-AT', { maximumFractionDigits: d });
export const uuid = () => crypto.randomUUID();

// Desktop-Layout (Seitenleiste statt Steuerknopf) ab dieser Breite
const DESKTOP = window.matchMedia('(min-width: 1024px)');
export const isDesktop = () => DESKTOP.matches;
export const onLayoutChange = (fn) => DESKTOP.addEventListener('change', fn);

export function toast(text, ms = 2600) {
  settleUndo();
  $toast.textContent = text;
  $toast.classList.remove('has-undo');
  $toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($toast.hidden = true), ms);
}

// Meldung mit „Rückgängig“ (5 s): undo() nimmt zurück, done() läuft, wenn nicht zurückgenommen wurde
let pendingUndo = null;
function settleUndo() { const p = pendingUndo; pendingUndo = null; p?.done(); }
export function undoToast(text, { undo, done = () => {} }, ms = 5000) {
  settleUndo();
  const p = pendingUndo = { done };
  $toast.innerHTML = '<span></span><button class="toast-undo" type="button">Rückgängig</button>';
  $toast.firstChild.textContent = text;
  $toast.classList.add('has-undo');
  $toast.hidden = false;
  clearTimeout(toast.t);
  const hide = () => { $toast.hidden = true; $toast.classList.remove('has-undo'); };
  toast.t = setTimeout(() => { if (pendingUndo === p) { pendingUndo = null; hide(); done(); } }, ms);
  $toast.lastChild.addEventListener('click', () => {
    if (pendingUndo !== p) return;
    pendingUndo = null;
    clearTimeout(toast.t);
    hide();
    undo();
  });
}

// Bestätigungsdialog in der Seite (statt confirm())
export function askConfirm(question, okLabel = 'OK', detail = '') {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'backdrop confirm-backdrop';
    wrap.innerHTML = `<div class="confirm" role="alertdialog" aria-modal="true">
      <div class="confirm-q">${esc(question)}</div>
      ${detail ? `<div class="confirm-d">${esc(detail)}</div>` : ''}
      <div class="confirm-actions">
        <button class="btn secondary" data-no>Abbrechen</button>
        <button class="btn danger-fill" data-yes>${esc(okLabel)}</button>
      </div></div>`;
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); });
    wrap.querySelector('[data-no]').addEventListener('click', () => done(false));
    wrap.querySelector('[data-yes]').addEventListener('click', () => done(true));
    document.body.appendChild(wrap);
    wrap.querySelector('[data-yes]').focus();
  });
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, val);
  } catch { return null; }
}

// ====================================================================
// Konfiguration prüfen, Supabase verbinden
// ====================================================================
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_KEY) {
  $app.innerHTML = '<div class="center"><div><h2>Fast fertig</h2><p class="muted">In <b>config.js</b> fehlen die Supabase-Daten.</p></div></div>';
  throw new Error('config.js nicht ausgefüllt');
}

export const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ====================================================================
// Zustand
// ====================================================================
export const state = {
  me: null,
  profile: null,       // Körperdaten und Ziele (duzio_profile)
  foods: [],           // eigene und gemerkte Lebensmittel
  recipes: [],
  meals: [],           // gespeicherte Mahlzeiten (Zusammenfassung je Portion)
  entries: [],         // Tagebuch (geladener Zeitraum, siehe data.js)
  water: {},           // Tag -> ml
  weights: [],         // [{ day, kg }] aufsteigend
  shopping: [],
  tab: 'home',
  day: null,           // gezeigter Tag im Tagebuch (YYYY-MM-DD, null = heute)
  recipeFilter: 'recipes',   // Bereich Rezepte: 'recipes' | 'meals' | 'foods'
  addKind: 'foods',          // Eintragen: zuletzt gewählte Art
  loaded: false,
};

export const foodById = (id) => state.foods.find((f) => f.id === id);
export const recipeById = (id) => state.recipes.find((r) => r.id === id);
export const mealById = (id) => state.meals.find((m) => m.id === id);
