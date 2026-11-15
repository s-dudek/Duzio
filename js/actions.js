// Tippen, Absenden und Eingaben in der Hauptansicht (ein Zuhörer für alles, über data-act)
import { $app, foodById, state } from './core.js';
import { deleteShopping, ensureDay, setWater } from './data.js';
import { addDays, today } from './dates.js';
import { diaryDay } from './diary.js';
import { openAmount, openFoodSearch } from './food-search.js';
import { openFoodEditor } from './foods.js';
import { openImport } from './import.js';
import { openMeal, openMealEditor } from './meals.js';
import { navigate } from './nav.js';
import { logout, openSettings } from './profile.js';
import { openRecipe, openRecipeEditor, recipeQuery, setRecipeTab } from './recipes.js';
import { openWeight, removeWeight } from './progress.js';
import { render } from './render.js';
import { clearDone, openPlanToShopping, shopSubmit, toggleShop } from './shopping.js';

const ACTS = {
  nav: (id) => navigate(id),
  add: (id) => openFoodSearch({ day: state.tab === 'diary' ? diaryDay() : today(), ...(id ? { meal: id } : {}) }),
  settings: openSettings,
  logout,
  day: (id) => {
    state.day = id === '0' ? null : addDays(diaryDay(), Number(id));
    if (state.day === today()) state.day = null;
    render();
    ensureDay(diaryDay());
  },
  water: (id) => {
    const day = state.tab === 'diary' ? diaryDay() : today();
    setWater(day, Math.max(0, (state.water[day] || 0) + Number(id)));
  },
  entry: (id) => { const e = state.entries.find((x) => x.id === id); if (e) openAmount({ entry: e }); },
  recipe: (id) => openRecipe(id),
  'recipe-tab': (id) => setRecipeTab(id),
  'new-recipe': () => openRecipeEditor(),
  meal: (id) => openMeal(id),
  'new-meal': () => openMealEditor(),
  import: openImport,
  'new-food': () => openFoodEditor(null),
  food: (id) => { const f = foodById(id); if (f) openFoodEditor(f); },
  'shop-toggle': toggleShop,
  'shop-del': (id) => deleteShopping([id]),
  'shop-plan': openPlanToShopping,
  'shop-clear': clearDone,
  weight: openWeight,
  'weight-del': removeWeight,
};

export function initActions() {
  $app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && ACTS[el.dataset.act]) ACTS[el.dataset.act](el.dataset.id || '');
  });
  // Kacheln (role="button") auch mit der Tastatur
  $app.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  });
  $app.addEventListener('submit', (e) => {
    if (e.target.id !== 'shop-add') return;
    e.preventDefault();
    shopSubmit(e.target);
  });
  $app.addEventListener('input', (e) => { if (e.target.id === 'rc-q') recipeQuery(e.target.value); });
}
