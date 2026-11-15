// Vorschau: statt Open Food Facts ein paar Beispielprodukte (die Vorschau darf keine fremden Seiten abfragen)
import { cleanFood } from '../js/data.js';

const RAW = [
  { id: 'off:9001', name: 'Haferflocken zart', brand: 'Bio Natura', barcode: '9001', kcal: 372, protein: 13.5, fat: 7, carbs: 58.7, portions: [{ n: 'Portion', g: 40 }] },
  { id: 'off:9002', name: 'Hühnerbrustfilet', brand: 'Hofer', barcode: '9002', kcal: 110, protein: 23, fat: 1.5, carbs: 0 },
  { id: 'off:9003', name: 'Basmatireis', brand: 'Golden Sun', barcode: '9003', kcal: 350, protein: 8, fat: 1, carbs: 77, portions: [{ n: 'Portion', g: 75 }] },
  { id: 'off:9004', name: 'Cottage Cheese', brand: 'Milsani', barcode: '9004', kcal: 98, protein: 12, fat: 4.3, carbs: 2.5, portions: [{ n: 'Becher', g: 200 }] },
  { id: 'off:9005', name: 'Vollmilch 3,5 %', brand: 'Milsani', barcode: '9005', unit: 'ml', kcal: 64, protein: 3.3, fat: 3.5, carbs: 4.8 },
];
const sample = () => RAW.map((f) => cleanFood({ ...f, source: 'off' }));   // erst beim Aufruf (Module laden im Kreis)

export async function searchOff(q) {
  const s = q.toLowerCase();
  return sample().filter((f) => f.name.toLowerCase().includes(s) || f.brand.toLowerCase().includes(s));
}
export async function barcodeOff(code) { return sample().find((f) => f.barcode === code) || null; }
