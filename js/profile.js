// Profil & Ziele: Körperdaten, Aktivität, Ziel -> Tagesbedarf (berechnet oder fest), Makro-Verteilung, Wasser
import { askConfirm, esc, fmt, num, sb, state, toast } from './core.js';
import { saveProfile, setWeight } from './data.js';
import { today } from './dates.js';
import { ACTIVITY, GOALS, MACROS, calcKcal, latestWeight } from './nutri.js';
import { closeSheet, openSheet, sheetHead } from './sheet.js';

export function openSettings() {
  const p = state.profile || { sex: null, birth_year: null, height_cm: null, activity: 1.375, goal: 'keep', goal_kg: null, kcal_goal: null, water_goal: 2500, macro: { c: 50, p: 20, f: 30 } };
  const v = (x) => (x == null ? '' : esc(x));
  const seg = (name, opts, cur) => `<div class="seg-view pf-seg" data-seg="${name}">${opts.map(([k, l]) => `<button type="button" data-v="${k}" class="${String(k) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const sh = openSheet(`${sheetHead('Profil & Ziele', { save: true })}
    <div class="field"><label>Geschlecht</label>${seg('sex', [['m', 'Mann'], ['w', 'Frau']], p.sex)}</div>
    <div class="grid3">
      <div class="field"><label for="pf-by">Geburtsjahr</label><input id="pf-by" class="input" inputmode="numeric" value="${v(p.birth_year)}"></div>
      <div class="field"><label for="pf-h">Größe (cm)</label><input id="pf-h" class="input" inputmode="decimal" value="${v(p.height_cm)}"></div>
      <div class="field"><label for="pf-kg">Gewicht (kg)</label><input id="pf-kg" class="input" inputmode="decimal" value="${latestWeight() ? esc(fmt(latestWeight(), 1)) : ''}"></div>
    </div>
    <div class="field"><label for="pf-act">Aktivität</label><select id="pf-act" class="select">${ACTIVITY.map(([k, l]) => `<option value="${k}" ${k === p.activity ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label>Ziel</label>${seg('goal', GOALS.map(([k, l]) => [k, l]), p.goal)}</div>
    <div class="grid2">
      <div class="field"><label for="pf-gkg">Zielgewicht (kg)</label><input id="pf-gkg" class="input" inputmode="decimal" value="${v(p.goal_kg)}"></div>
      <div class="field"><label for="pf-water">Wasser (ml / Tag)</label><input id="pf-water" class="input" inputmode="numeric" value="${v(p.water_goal)}"></div>
    </div>
    <div class="pf-calc" id="pf-calc"></div>
    <div class="field"><label for="pf-kcal">Eigenes kcal-Ziel (leer = berechnet)</label><input id="pf-kcal" class="input" inputmode="numeric" value="${v(p.kcal_goal)}"></div>
    <div class="field"><label>Makros (% der kcal)</label><div class="grid3">
      ${MACROS.map(([, l, c, , s]) => `<label class="pf-m" style="--mc:${c}"><small>${l}</small><input class="input" data-macro="${s}" inputmode="numeric" value="${v(p.macro[s])}"></label>`).join('')}
    </div><div class="pf-msum" id="pf-msum"></div></div>
    <button type="button" class="btn danger block" data-logout>Abmelden</button>`, { full: true });

  const pick = { sex: p.sex, goal: p.goal };
  sh.querySelectorAll('[data-seg]').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    pick[g.dataset.seg] = b.dataset.v;
    g.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
    update();
  }));
  const val = (id) => sh.querySelector(id).value.trim();
  const form = () => ({
    sex: pick.sex, goal: pick.goal, birth_year: val('#pf-by') ? num(val('#pf-by'), 1900, 2100) : null,
    height_cm: val('#pf-h') ? num(val('#pf-h'), 80, 250) : null, activity: num(val('#pf-act'), 1.1, 2.2, 1.375),
    goal_kg: val('#pf-gkg') ? num(val('#pf-gkg'), 20, 400) : null, water_goal: num(val('#pf-water'), 0, 8000, 2500),
    kcal_goal: val('#pf-kcal') ? num(val('#pf-kcal'), 800, 6000) : null,
    macro: Object.fromEntries([...sh.querySelectorAll('[data-macro]')].map((i) => [i.dataset.macro, num(i.value, 0, 100)])),
  });
  const update = () => {
    const f = form(), kg = num(val('#pf-kg'), 0, 400) || null, kcal = calcKcal(f, kg);
    sh.querySelector('#pf-calc').innerHTML = kcal ? `Berechneter Bedarf: <b>${fmt(kcal)} kcal</b> pro Tag` : 'Für die Berechnung Geschlecht, Geburtsjahr, Größe und Gewicht ausfüllen.';
    const total = f.macro.c + f.macro.p + f.macro.f;
    sh.querySelector('#pf-msum').innerHTML = `Summe ${fmt(total)} %${total === 100 ? '' : ' – muss 100 % ergeben'}`;
    sh.querySelector('#pf-msum').classList.toggle('err', total !== 100);
  };
  sh.addEventListener('input', update);
  update();

  sh.querySelector('[data-save]').addEventListener('click', () => {
    const f = form();
    if (f.macro.c + f.macro.p + f.macro.f !== 100) return toast('Die Makros müssen zusammen 100 % ergeben.');
    const kg = num(val('#pf-kg'), 0, 400);
    if (kg >= 20 && kg !== latestWeight()) setWeight(today(), kg);
    saveProfile(f);
    closeSheet();
  });
  sh.querySelector('[data-logout]').addEventListener('click', logout);
}

export async function logout() {
  if (await askConfirm('Abmelden?', 'Abmelden')) { closeSheet(); sb.auth.signOut(); }
}
