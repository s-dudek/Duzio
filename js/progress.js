// Fortschritt: Gewicht (Verlauf, Ziel), kcal und Makros der letzten 7 Tage
import { askConfirm, esc, fmt, num, state, toast } from './core.js';
import { deleteWeight, setWeight } from './data.js';
import { addDays, dayLabel, isDay, shortDate, today } from './dates.js';
import { ICON } from './icons.js';
import { MACROS, goals, latestWeight, sum, totalsOn, wd } from './nutri.js';
import { closeSheet, openSheet, sheetHead, stepper, wireSteppers } from './sheet.js';

// Linie der letzten 90 Tage (SVG, Punkte je Messung), Ziel als gestrichelte Linie
function weightChart(goalKg) {
  const from = addDays(today(), -90), pts = state.weights.filter((w) => w.day >= from);
  if (pts.length < 2) return '<p class="empty">Ab zwei Messungen erscheint hier der Verlauf.</p>';
  const W = 600, H = 180, P = 14;
  const vals = pts.map((p) => p.kg).concat(goalKg ? [goalKg] : []);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const t0 = new Date(pts[0].day).getTime(), span = Math.max(1, new Date(pts.at(-1).day).getTime() - t0);
  const x = (d) => P + ((new Date(d).getTime() - t0) / span) * (W - 2 * P);
  const y = (kg) => P + (1 - (kg - lo) / (hi - lo)) * (H - 2 * P);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  return `<svg class="wchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Gewichtsverlauf">
    ${goalKg ? `<line class="wc-goal" x1="0" x2="${W}" y1="${y(goalKg).toFixed(1)}" y2="${y(goalKg).toFixed(1)}"/>` : ''}
    <path class="wc-area" d="${line} L${x(pts.at(-1).day).toFixed(1)} ${H} L${x(pts[0].day).toFixed(1)} ${H}Z"/>
    <path class="wc-line" d="${line}"/>
    ${pts.map((p) => `<circle cx="${x(p.day).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="3.5"/>`).join('')}</svg>
    <div class="wc-axis"><span>${shortDate(pts[0].day)}</span><span>${lo}–${hi} kg</span><span>${shortDate(pts.at(-1).day)}</span></div>`;
}

export function renderProgress() {
  const g = goals(), kg = latestWeight(), first = state.weights[0]?.kg, goalKg = state.profile?.goal_kg;
  const days = Array.from({ length: 7 }, (_, k) => addDays(today(), k - 6));
  const tot = days.map((d) => ({ d, ...totalsOn(d) }));
  const logged = tot.filter((t) => t.kcal > 0);
  const avg = logged.length ? sum(logged) : null;
  if (avg) for (const k in avg) avg[k] /= logged.length;
  const max = Math.max(g.kcal * 1.2, ...tot.map((t) => t.kcal));
  const diff = kg && first ? kg - first : 0;
  return `<section class="card">
      <div class="meal-h"><span class="mt-ic">${ICON.scale}</span><span class="meal-t"><b>Gewicht</b><small>${state.weights.length} Messungen</small></span></div>
      <div class="pg-stats">
        <span><b>${kg ? fmt(kg, 1) : '–'}</b><small>aktuell kg</small></span>
        <span><b>${first && kg ? (diff > 0 ? '+' : '') + fmt(diff, 1) : '–'}</b><small>seit Start</small></span>
        <span><b>${goalKg ? fmt(goalKg, 1) : '–'}</b><small>Ziel kg</small></span>
      </div>
      ${weightChart(goalKg)}
      ${state.weights.length ? `<div class="pg-list">${state.weights.slice(-6).reverse().map((w) => `<div class="pg-row"><span>${esc(dayLabel(w.day))}</span><b>${fmt(w.kg, 1)} kg</b>
        <button class="lgear" data-act="weight-del" data-id="${w.day}" aria-label="Löschen">${ICON.close}</button></div>`).join('')}</div>` : ''}
    </section>
    <section class="card">
      <div class="meal-h"><span class="mt-ic">${ICON.flame}</span><span class="meal-t"><b>Letzte 7 Tage</b><small>Ziel ${fmt(g.kcal)} kcal</small></span></div>
      <div class="kbars">
        <div class="kb-area">${tot.map((t) => `<span class="${t.kcal > g.kcal ? 'over' : ''} ${t.d === today() ? 'now' : ''}"><i style="height:${((t.kcal / max) * 100).toFixed(0)}%"><em>${t.kcal ? fmt(t.kcal) : ''}</em></i></span>`).join('')}
          <b class="kb-goal" style="bottom:${((g.kcal / max) * 100).toFixed(1)}%"></b></div>
        <div class="kb-days">${tot.map((t) => `<small>${wd(t.d)}</small>`).join('')}</div></div>
      ${avg ? `<div class="pg-stats">
        <span><b>${fmt(avg.kcal)}</b><small>Ø kcal</small></span>
        ${MACROS.map(([k, l, c]) => `<span style="--mc:${c}"><b>${fmt(avg[k])} g</b><small>Ø ${l}</small></span>`).join('')}
      </div>` : '<p class="empty">Noch nichts eingetragen.</p>'}
    </section>`;
}

export function openWeight() {
  const sh = openSheet(`${sheetHead('Gewicht', { save: true })}
    <div class="field"><label for="w-day">Tag</label><input id="w-day" type="date" class="input" value="${today()}" max="${today()}"></div>
    <div class="field"><label>kg</label>${stepper('w-kg', latestWeight() || 75, 0.1)}</div>`);
  wireSteppers(sh);
  sh.querySelector('[data-save]').addEventListener('click', () => {
    const day = sh.querySelector('#w-day').value, kg = num(sh.querySelector('#w-kg').value, 0, 400);
    if (!isDay(day) || kg < 20) return toast('Bitte Tag und Gewicht prüfen.');
    setWeight(day, kg);
    closeSheet();
  });
}

export async function removeWeight(day) {
  if (await askConfirm('Messung löschen?', 'Löschen')) deleteWeight(day);
}
