// Gemeinsame Anzeigen: kcal-Ring, Makro-Balken, Wasser-Gläser (Tagebuch und Startseite)
import { esc, fmt } from './core.js';
import { ICON } from './icons.js';
import { MACROS } from './nutri.js';

const R = 52, LEN = 2 * Math.PI * R;

// Ring wie bei Yazio: in der Mitte „übrig“, Ring = gegessen; über dem Ziel rot
export function kcalRing(eaten, goal, { label = true } = {}) {
  const left = Math.round(goal - eaten), over = left < 0;
  const part = Math.min(1, goal ? eaten / goal : 0);
  return `<div class="ring ${over ? 'over' : ''}">
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}"/><circle class="on" cx="60" cy="60" r="${R}" stroke-dasharray="${(part * LEN).toFixed(1)} ${LEN.toFixed(1)}"/></svg>
    <span class="ring-in"><b>${fmt(Math.abs(left))}</b>${label ? `<small>${over ? 'kcal zu viel' : 'kcal übrig'}</small>` : ''}</span></div>`;
}

// Makros: Balken mit gegessen / Ziel in Gramm
export function macroBars(t, g, { compact = false } = {}) {
  return `<div class="mbars ${compact ? 'compact' : ''}">${MACROS.map(([k, l, c]) => {
    const pct = g[k] ? Math.min(100, (t[k] / g[k]) * 100) : 0;
    return `<div class="mb" style="--mc:${c}"><small>${esc(l)}</small><span class="mb-bar"><i style="width:${pct.toFixed(0)}%"></i></span>
      <b>${fmt(t[k])}<em> / ${fmt(g[k])} g</em></b></div>`;
  }).join('')}</div>`;
}

// Wasser: Gläser zu 250 ml, gefüllte dunkel
export function waterGlasses(ml, goal) {
  const n = Math.max(8, Math.ceil(goal / 250)), full = Math.floor(ml / 250);
  return `<div class="glasses">${Array.from({ length: n }, (_, i) => `<span class="gl ${i < full ? 'on' : ''}">${ICON.drop}</span>`).join('')}</div>`;
}
