// Datum: Umrechnen und Beschriften
export const ymd = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const today = () => ymd(new Date());
export const mondayOf = (s) => addDays(s, -((parseYmd(s).getDay() + 6) % 7));
export const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// „Heute“, „Gestern“, „Morgen“ oder Wochentag mit Datum
export function dayLabel(s, long = false) {
  const t = today();
  if (s === t) return 'Heute';
  if (s === addDays(t, -1)) return 'Gestern';
  if (s === addDays(t, 1)) return 'Morgen';
  return parseYmd(s).toLocaleDateString('de-AT', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
}
export const shortDate = (s) => parseYmd(s).toLocaleDateString('de-AT', { day: 'numeric', month: 'numeric' });
