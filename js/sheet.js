// Fenster von unten (Sheets) und gemeinsame Bausteine darin
import { $sheetRoot, esc } from './core.js';
import { ICON } from './icons.js';

// Knöpfe oben rechts: rund, immer gleich angeordnet – Bearbeiten, Speichern, Schließen, Löschen.
// data-close schließt überall gleich; data-edit, data-save und data-del verdrahtet das jeweilige Fenster.
export function sheetActs({ edit = false, save = false, del = false, saveLabel = 'Speichern', delLabel = 'Löschen' } = {}) {
  const b = (attr, icon, label, cls = '') => `<button type="button" class="sh-b ${cls}" ${attr} aria-label="${esc(label)}" title="${esc(label)}">${ICON[icon]}</button>`;
  return `<span class="sh-acts">${edit ? b('data-edit', 'pen', 'Bearbeiten') : ''}${save ? b('data-save', 'check', saveLabel, 'save') : ''}${b('data-close', 'close', 'Schließen')}${del ? b('data-del', 'trash', delLabel, 'del') : ''}</span>`;
}

export const sheetHead = (title, acts) => `<div class="sheet-head"><h2>${esc(title)}</h2>${sheetActs(acts)}</div>`;

let onSheetClose = null;

export function openSheet(html, { full = false, onClose = null } = {}) {
  closeSheet();
  onSheetClose = onClose;
  $sheetRoot.innerHTML = `<div class="backdrop"><div class="sheet ${full ? 'full' : ''}">${html}</div></div>`;
  const bd = $sheetRoot.querySelector('.backdrop');
  bd.addEventListener('click', (e) => { if (e.target === bd) closeSheet(); });
  bd.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));
  document.body.style.overflow = 'hidden';
  return $sheetRoot.querySelector('.sheet');
}

export function closeSheet() {
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  $sheetRoot.innerHTML = '';
  document.body.style.overflow = '';
}

// Zahlenfeld mit − / + (Menge, Portionen)
export const stepper = (id, value, step = 1) => `<div class="stepper" data-step="${step}">
  <button type="button" class="st-b" data-st="-1" aria-label="Weniger">${ICON.minus}</button>
  <input id="${id}" class="st-in" inputmode="decimal" value="${esc(value)}" aria-label="Menge">
  <button type="button" class="st-b" data-st="1" aria-label="Mehr">${ICON.plus}</button></div>`;

// − / + in einem Fenster verdrahten; onChange nach jeder Änderung
export function wireSteppers(root, onChange = () => {}) {
  root.querySelectorAll('.stepper').forEach((s) => {
    const inp = s.querySelector('input'), step = Number(s.dataset.step) || 1;
    s.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => {
      const v = Number(String(inp.value).replace(',', '.')) || 0;
      inp.value = String(Math.max(step, Math.round((v + step * Number(b.dataset.st)) * 100) / 100));
      onChange();
    }));
    inp.addEventListener('input', onChange);
  });
}
