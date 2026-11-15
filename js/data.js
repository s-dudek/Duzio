// Laden und Speichern (Supabase). Alles wird beim Laden geprüft, bevor es in den Zustand kommt.
import { clean, num, sb, state, toast } from './core.js';
import { addDays, isDay, today } from './dates.js';
import { busy } from './loader.js';
import { render } from './render.js';

const T = {
  profile: 'duzio_profile', foods: 'duzio_foods', recipes: 'duzio_recipes', entries: 'duzio_entries',
  water: 'duzio_water', weights: 'duzio_weights', shopping: 'duzio_shopping',
};
const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];
export const AISLES = ['Obst & Gemüse', 'Brot & Backwaren', 'Kühlregal', 'Fleisch & Fisch', 'Tiefkühl', 'Trockenware & Konserven', 'Gewürze & Öle', 'Getränke', 'Süßes & Snacks', 'Drogerie & Haushalt', 'Sonstiges'];

// ---------- Prüfen beim Laden ----------
const nutr = (r) => ({ kcal: num(r.kcal, 0, 1e5), protein: num(r.protein, 0, 1e4), fat: num(r.fat, 0, 1e4), carbs: num(r.carbs, 0, 1e4) });
const list = (a, max = 200) => (Array.isArray(a) ? a.slice(0, max) : []);

export const cleanFood = (f) => ({
  id: String(f.id), name: clean(f.name) || 'Ohne Name', brand: clean(f.brand, 120), barcode: /^\d{6,14}$/.test(f.barcode || '') ? f.barcode : null,
  unit: f.unit === 'ml' ? 'ml' : 'g', ...nutr(f), sugar: f.sugar == null ? null : num(f.sugar, 0, 100), fiber: f.fiber == null ? null : num(f.fiber, 0, 100),
  salt: f.salt == null ? null : num(f.salt, 0, 100), source: f.source === 'off' ? 'off' : 'own', fav: !!f.fav,
  portions: list(f.portions, 12).map((p) => ({ n: clean(p?.n, 40), g: num(p?.g, 0, 5000) })).filter((p) => p.n && p.g > 0),
  updated_at: String(f.updated_at || ''),
});

export const cleanIngredient = (i) => ({
  name: clean(i?.name) || 'Zutat', g: num(i?.g, 0, 100000), label: clean(i?.label, 60), aisle: AISLES.includes(i?.aisle) ? i.aisle : 'Sonstiges',
  food_id: typeof i?.food_id === 'string' ? i.food_id : null, ...nutr(i || {}),
});

export const cleanRecipe = (r) => ({
  id: String(r.id), title: clean(r.title) || 'Rezept', servings: num(r.servings, 0.5, 100, 2), minutes: r.minutes == null ? null : num(r.minutes, 0, 1440),
  tags: list(r.tags, 12).map((t) => clean(t, 30)).filter(Boolean), ingredients: list(r.ingredients).map(cleanIngredient),
  steps: list(r.steps, 60).map((s) => clean(s, 1000)).filter(Boolean), note: clean(r.note, 4000, true), fav: !!r.fav, updated_at: String(r.updated_at || ''),
});

const cleanEntry = (e) => ({
  id: String(e.id), day: isDay(e.day) ? e.day : today(), meal: MEAL_KEYS.includes(e.meal) ? e.meal : 'snack', name: clean(e.name, 200) || 'Eintrag',
  food_id: e.food_id || null, recipe_id: e.recipe_id || null, amount: num(e.amount, 0, 1e5), unit_label: clean(e.unit_label, 40) || 'g',
  grams: num(e.grams, 0, 1e5), ...nutr(e), planned: !!e.planned, created_at: String(e.created_at || ''),
});

const cleanShop = (s) => ({
  id: String(s.id), name: clean(s.name) || 'Eintrag', qty: s.qty == null ? null : num(s.qty, 0, 1e5), unit: clean(s.unit, 40),
  aisle: AISLES.includes(s.aisle) ? s.aisle : 'Sonstiges', done: !!s.done, created_at: String(s.created_at || ''),
});

const cleanProfile = (p) => p && ({
  sex: p.sex === 'm' || p.sex === 'w' ? p.sex : null, birth_year: p.birth_year ? num(p.birth_year, 1900, 2100) : null,
  height_cm: p.height_cm ? num(p.height_cm, 80, 250) : null, activity: p.activity ? num(p.activity, 1.1, 2.2) : null,
  goal: ['lose', 'keep', 'gain'].includes(p.goal) ? p.goal : 'keep', goal_kg: p.goal_kg ? num(p.goal_kg, 20, 400) : null,
  kcal_goal: p.kcal_goal ? num(p.kcal_goal, 800, 6000) : null, water_goal: num(p.water_goal, 0, 8000, 2500),
  macro: { c: num(p.macro?.c, 0, 100, 50), p: num(p.macro?.p, 0, 100, 20), f: num(p.macro?.f, 0, 100, 30) },
});

// ---------- Laden ----------
// Tagebuch: geladener Zeitraum; Tage ausserhalb holt ensureDay nach
const range = { from: null, to: null };

async function must(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function loadAll() {
  const t = today();
  range.from = addDays(t, -120);
  range.to = addDays(t, 60);
  try {
    const [prof, foods, recipes, entries, water, weights, shopping] = await busy(Promise.all([
      must(sb.from(T.profile).select('*').limit(1)),
      must(sb.from(T.foods).select('*').order('name')),
      must(sb.from(T.recipes).select('*').order('title')),
      must(sb.from(T.entries).select('*').gte('day', range.from).lte('day', range.to).order('created_at')),
      must(sb.from(T.water).select('day,ml').gte('day', range.from).lte('day', range.to)),
      must(sb.from(T.weights).select('day,kg').order('day')),
      must(sb.from(T.shopping).select('*').order('created_at')),
    ]));
    Object.assign(state, {
      profile: cleanProfile(prof[0]) || null,
      foods: foods.map(cleanFood),
      recipes: recipes.map(cleanRecipe),
      entries: entries.map(cleanEntry),
      water: Object.fromEntries(water.filter((w) => isDay(w.day)).map((w) => [w.day, num(w.ml, 0, 20000)])),
      weights: weights.filter((w) => isDay(w.day)).map((w) => ({ day: w.day, kg: num(w.kg, 20, 400) })),
      shopping: shopping.map(cleanShop),
      loaded: true,
    });
    render();
  } catch (e) {
    console.error(e);
    toast('Laden fehlgeschlagen. Bitte Verbindung prüfen.');
    if (!state.loaded) setTimeout(loadAll, 5000);
  }
}

// Tag ausserhalb des geladenen Zeitraums (weit zurückgeblättert)
export async function ensureDay(day) {
  if (day >= range.from && day <= range.to) return;
  try {
    const [entries, water] = await busy(Promise.all([
      must(sb.from(T.entries).select('*').eq('day', day).order('created_at')),
      must(sb.from(T.water).select('day,ml').eq('day', day)),
    ]));
    state.entries = state.entries.filter((e) => e.day !== day).concat(entries.map(cleanEntry));
    if (water[0]) state.water[day] = num(water[0].ml, 0, 20000);
    render();
  } catch { toast('Tag konnte nicht geladen werden.'); }
}

// beim Zurückkehren in die App (z. B. nach längerer Zeit) neu laden
export function initSync() {
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (state.me && state.loaded && Date.now() - hiddenAt > 5 * 60e3) loadAll();
  });
}

// ---------- Speichern ----------
// Änderung sofort anzeigen, dann speichern; bei Fehler Meldung und neu laden
async function write(q) {
  render();
  const { error } = await q;
  if (error) {
    console.error(error);
    toast('Speichern fehlgeschlagen.');
    loadAll();
    return false;
  }
  return true;
}

export function saveProfile(patch) {
  state.profile = cleanProfile({ ...(state.profile || {}), ...patch });
  return write(sb.from(T.profile).upsert({ owner_id: state.me, ...state.profile, updated_at: new Date().toISOString() }));
}

export function addEntries(rows) {
  const ok = rows.map((r) => cleanEntry({ ...r, created_at: new Date().toISOString() }));
  state.entries.push(...ok);
  return write(sb.from(T.entries).insert(ok.map(({ created_at, ...r }) => ({ ...r, owner_id: state.me }))));
}

export function updateEntry(id, patch) {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return;
  Object.assign(e, cleanEntry({ ...e, ...patch }));
  const { id: _id, created_at, ...row } = e;
  return write(sb.from(T.entries).update(row).eq('id', id));
}

export function deleteEntries(ids) {
  state.entries = state.entries.filter((e) => !ids.includes(e.id));
  return write(sb.from(T.entries).delete().in('id', ids));
}

export function saveFood(f) {
  const food = cleanFood({ ...f, updated_at: new Date().toISOString() });
  const i = state.foods.findIndex((x) => x.id === food.id);
  if (i >= 0) state.foods[i] = food; else state.foods.push(food);
  const { updated_at, ...row } = food;
  return write(sb.from(T.foods).upsert({ ...row, owner_id: state.me, updated_at }));
}

export function deleteFood(id) {
  state.foods = state.foods.filter((f) => f.id !== id);
  return write(sb.from(T.foods).delete().eq('id', id));
}

export function saveRecipe(r) {
  const rec = cleanRecipe({ ...r, updated_at: new Date().toISOString() });
  const i = state.recipes.findIndex((x) => x.id === rec.id);
  if (i >= 0) state.recipes[i] = rec; else state.recipes.push(rec);
  state.recipes.sort((a, b) => a.title.localeCompare(b.title, 'de'));
  return write(sb.from(T.recipes).upsert({ ...rec, owner_id: state.me }));
}

export function deleteRecipe(id) {
  state.recipes = state.recipes.filter((r) => r.id !== id);
  return write(sb.from(T.recipes).delete().eq('id', id));
}

export function setWater(day, ml) {
  state.water[day] = num(ml, 0, 20000);
  return write(sb.from(T.water).upsert({ owner_id: state.me, day, ml: state.water[day] }));
}

export function setWeight(day, kg) {
  const v = num(kg, 20, 400);
  state.weights = state.weights.filter((w) => w.day !== day).concat({ day, kg: v }).sort((a, b) => a.day.localeCompare(b.day));
  return write(sb.from(T.weights).upsert({ owner_id: state.me, day, kg: v }));
}

export function deleteWeight(day) {
  state.weights = state.weights.filter((w) => w.day !== day);
  return write(sb.from(T.weights).delete().eq('day', day));
}

export function addShopping(rows) {
  const ok = rows.map((r) => cleanShop({ ...r, created_at: new Date().toISOString() }));
  state.shopping.push(...ok);
  return write(sb.from(T.shopping).insert(ok.map(({ created_at, ...r }) => ({ ...r, owner_id: state.me }))));
}

export function updateShopping(id, patch) {
  const s = state.shopping.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, cleanShop({ ...s, ...patch }));
  const { id: _id, created_at, ...row } = s;
  return write(sb.from(T.shopping).update(row).eq('id', id));
}

export function deleteShopping(ids) {
  state.shopping = state.shopping.filter((s) => !ids.includes(s.id));
  return write(sb.from(T.shopping).delete().in('id', ids));
}
