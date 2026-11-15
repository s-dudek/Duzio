// Nährwerte: Tagesziel aus den Körperdaten, Summen, Umrechnen auf Mengen
import { num, round, state } from './core.js';
import { parseYmd } from './dates.js';

export const MEALS = [
  ['breakfast', 'Frühstück', 'bread'],
  ['lunch', 'Mittagessen', 'pot'],
  ['dinner', 'Abendessen', 'fork'],
  ['snack', 'Snacks', 'candy'],
];
export const mealName = (k) => MEALS.find(([m]) => m === k)?.[1] || 'Snacks';

// Makros: Name, Farbe, kcal je Gramm
export const MACROS = [
  ['carbs', 'Kohlenhydrate', '#D9873E', 4, 'c'],
  ['protein', 'Eiweiß', '#3E7CA8', 4, 'p'],
  ['fat', 'Fett', '#7A5AA6', 9, 'f'],
];

export const ACTIVITY = [
  [1.2, 'Kaum Bewegung (Büro, kein Sport)'],
  [1.375, 'Leicht aktiv (1–3× Sport pro Woche)'],
  [1.55, 'Aktiv (3–5× Sport pro Woche)'],
  [1.725, 'Sehr aktiv (täglich Sport)'],
];
export const GOALS = [['lose', 'Abnehmen', -500], ['keep', 'Gewicht halten', 0], ['gain', 'Zunehmen / Muskelaufbau', 300]];

export const latestWeight = () => state.weights.at(-1)?.kg || null;

// Grundumsatz nach Mifflin-St Jeor mal Aktivität, dazu das Ziel (wie Yazio: Abnehmen −500 kcal)
export function calcKcal(p = state.profile, kg = latestWeight()) {
  if (!p?.height_cm || !p?.birth_year || !p?.sex || !kg) return null;
  const age = new Date().getFullYear() - p.birth_year;
  const bmr = 10 * kg + 6.25 * p.height_cm - 5 * age + (p.sex === 'm' ? 5 : -161);
  const delta = GOALS.find(([g]) => g === p.goal)?.[2] || 0;
  return Math.round((bmr * (p.activity || 1.375) + delta) / 10) * 10;
}

// Tagesziele: kcal (fest eingestellt, berechnet oder 2000), Makros in Gramm, Wasser
export function goals() {
  const p = state.profile || {};
  const kcal = p.kcal_goal || calcKcal() || 2000;
  const m = p.macro || { c: 50, p: 20, f: 30 };
  const g = { kcal, water: p.water_goal ?? 2500 };
  for (const [k, , , per, s] of MACROS) g[k] = Math.round((kcal * num(m[s], 0, 100, 0)) / 100 / per);
  return g;
}

// Summe von Einträgen
export function sum(list) {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const e of list) for (const k in t) t[k] += Number(e[k]) || 0;
  return t;
}
export const entriesOn = (day, { planned = false } = {}) => state.entries.filter((e) => e.day === day && !!e.planned === planned);
export const totalsOn = (day) => sum(entriesOn(day));

// Nährwerte für eine Menge in Gramm aus Werten je 100 g
export const forGrams = (per100, g) => ({
  kcal: round((num(per100.kcal) * g) / 100, 1),
  protein: round((num(per100.protein) * g) / 100, 1),
  fat: round((num(per100.fat) * g) / 100, 1),
  carbs: round((num(per100.carbs) * g) / 100, 1),
});

// Rezept: Summe aller Zutaten und je Portion
export function recipeTotals(r) {
  const all = sum((r.ingredients || []).map((i) => forGrams(i, num(i.g))));
  const n = num(r.servings, 0.1, 100, 1);
  const per = {};
  for (const k in all) per[k] = all[k] / n;
  return { all, per, grams: (r.ingredients || []).reduce((s, i) => s + num(i.g), 0) };
}

// Wochentag-Kürzel für Diagramme
export const wd = (s) => parseYmd(s).toLocaleDateString('de-AT', { weekday: 'narrow' });
