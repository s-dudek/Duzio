// Open Food Facts: freie Lebensmittel-Datenbank (Suche nach Name und Barcode).
// Antworten sind fremde Daten: alles wird über cleanFood geprüft, bevor es angezeigt wird.
import { clean, num, round } from './core.js';
import { cleanFood } from './data.js';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_de,brands,nutriments,serving_quantity,quantity';

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error('OFF ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

// Produkt von Open Food Facts in ein Lebensmittel umwandeln (Werte je 100 g/ml); ohne Nährwerte: null
function toFood(p) {
  const n = p?.nutriments || {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null);
  const name = clean(p?.product_name_de || p?.product_name);
  if (!name || kcal == null || !Number.isFinite(Number(kcal))) return null;
  const opt = (v) => (v == null || v === '' ? null : round(num(v, 0, 100), 1));
  const serving = num(p.serving_quantity, 0, 5000);
  return cleanFood({
    id: 'off:' + String(p.code || '').replace(/\D/g, ''),
    name, brand: clean(String(p.brands || '').split(',')[0], 120), barcode: String(p.code || ''),
    unit: /\d\s*(ml|cl|l)\b/i.test(p.quantity || '') ? 'ml' : 'g',
    kcal: round(num(kcal, 0, 1000), 1), protein: opt(n.proteins_100g) || 0, fat: opt(n.fat_100g) || 0, carbs: opt(n.carbohydrates_100g) || 0,
    sugar: opt(n.sugars_100g), fiber: opt(n.fiber_100g), salt: opt(n.salt_100g),
    portions: serving ? [{ n: 'Portion', g: serving }] : [], source: 'off',
  });
}

export async function searchOff(q) {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q.slice(0, 80))}&search_simple=1&action=process&json=1&page_size=24&lc=de&fields=${FIELDS}`;
  const d = await get(url);
  return (Array.isArray(d?.products) ? d.products : []).map(toFood).filter(Boolean);
}

export async function barcodeOff(code) {
  if (!/^\d{6,14}$/.test(code)) return null;
  const d = await get(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`);
  return d?.status === 1 ? toFood(d.product) : null;
}
