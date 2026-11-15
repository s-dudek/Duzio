// Code einfügen: Rezepte und Lebensmittel, die Claude im Chat zusammenstellt (Format in CLAUDE.md).
// Der Code ist fremder Text: nur JSON, nur bekannte Felder, alles über cleanRecipe/cleanFood geprüft.
import { clean, esc, state, toast, uuid } from './core.js';
import { cleanFood, cleanRecipe, saveFood, saveRecipe } from './data.js';
import { closeSheet, openSheet, sheetHead } from './sheet.js';

function parse(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a || b - a > 500000) throw new Error('Kein Code gefunden');
  const d = JSON.parse(text.slice(a, b + 1));
  const arr = (x) => (Array.isArray(x) ? x.slice(0, 100) : []);
  const recipes = arr(d.rezepte).map((r) => cleanRecipe({
    id: uuid(), title: r.titel, servings: r.portionen, minutes: r.dauer_min ?? null, tags: r.tags, note: r.hinweis, steps: r.zubereitung,
    ingredients: arr(r.zutaten).map((z) => ({ name: z.name, g: z.g, label: z.einheit, aisle: z.abteilung, kcal: z.kcal, protein: z.eiweiss, fat: z.fett, carbs: z.kohlenhydrate })),
  }));
  const foods = arr(d.lebensmittel).map((f) => cleanFood({
    id: uuid(), name: f.name, brand: f.marke, unit: f.einheit, kcal: f.kcal, protein: f.eiweiss, fat: f.fett, carbs: f.kohlenhydrate,
    sugar: f.zucker ?? null, fiber: f.ballaststoffe ?? null, salt: f.salz ?? null, portions: arr(f.portionen).map((p) => ({ n: p.name, g: p.g })), source: 'own',
  }));
  return { recipes, foods };
}

export function openImport() {
  const sh = openSheet(`${sheetHead('Code einfügen', { save: true, saveLabel: 'Übernehmen' })}
    <textarea id="im-t" class="textarea" placeholder="DUZIO { … }" spellcheck="false" autocapitalize="off"></textarea>
    <div id="im-prev" class="muted"></div>`);
  const $t = sh.querySelector('#im-t'), $p = sh.querySelector('#im-prev');
  let parsed = null;
  $t.addEventListener('input', () => {
    try {
      parsed = parse($t.value);
      const names = [...parsed.recipes.map((r) => r.title), ...parsed.foods.map((f) => f.name)];
      $p.innerHTML = names.length ? `Erkannt: ${names.map((n) => `<b>${esc(n)}</b>`).join(', ')}` : 'Keine Rezepte oder Lebensmittel im Code.';
    } catch { parsed = null; $p.textContent = $t.value.trim() ? 'Code ist unvollständig oder fehlerhaft.' : ''; }
  });
  sh.querySelector('[data-save]').addEventListener('click', async () => {
    if (!parsed || !(parsed.recipes.length + parsed.foods.length)) return toast('Kein gültiger Code.');
    // gleichnamige Rezepte werden ersetzt (Code nochmal eingefügt = aktualisiert)
    for (const r of parsed.recipes) {
      const same = state.recipes.find((x) => x.title.toLowerCase() === r.title.toLowerCase());
      await saveRecipe(same ? { ...r, id: same.id, fav: same.fav } : r);
    }
    for (const f of parsed.foods) {
      const same = state.foods.find((x) => x.name.toLowerCase() === clean(f.name).toLowerCase() && x.source === 'own');
      await saveFood(same ? { ...f, id: same.id, fav: same.fav } : f);
    }
    toast(`${parsed.recipes.length} Rezepte, ${parsed.foods.length} Lebensmittel übernommen`);
    closeSheet();
  });
}

