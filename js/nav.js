// Bereiche der App und der Wechsel zwischen ihnen (Steuerknopf am Smartphone, Seitenleiste am Desktop)
import { state } from './core.js';
import { openFoodSearch } from './food-search.js';
import { render } from './render.js';
import { closeSheet } from './sheet.js';

export const NAV = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'diary', label: 'Tagebuch', icon: 'diary' },
  { key: 'recipes', label: 'Rezepte', icon: 'book' },
  { key: 'shopping', label: 'Einkauf', icon: 'cart' },
  { key: 'progress', label: 'Fortschritt', icon: 'chart' },
  { key: 'add', label: 'Eintragen', icon: 'plus' },
];

// transition: Funktion, die den Seitenwechsel animiert ausführt (Steuerknopf), sonst sofort
export function navigate(k, transition = (fn) => fn()) {
  if (!NAV.some((x) => x.key === k)) return;
  if (k === 'add') return openFoodSearch();
  closeSheet();
  if (state.tab === k) return;
  transition(() => {
    state.tab = k;
    render();
    document.querySelector('.main')?.scrollTo({ top: 0 });
  });
}
