// Ladesymbol: das Duzio-Zeichen als feine Linie (drei Kreise, dazu Stiel und Blatt des Apfels), auf der ein kräftiger Abschnitt rundum läuft (1,8 s je Runde, nur CSS).
// Im Startbild, statt „Lädt …“ und klein unten, solange die App Daten nachlädt (busy).
const C = (cx, cy, r, a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)].map((v) => v.toFixed(1)).join(' ');
const arc = (cx, cy, r, a0, a1) => `${C(cx, cy, r, a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${C(cx, cy, r, a1)}`;
const TOP = [128, 92, 75], LEFT = [88, 164, 76], RIGHT = [168, 164, 76];

// Linien des Zeichens: Kreis oben, Bögen links und rechts unten, Stiel, Blatt (je ein Pfad, damit das Startbild sie einzeln auflösen kann)
const BASE = [`${arc(...TOP, 0, 180)} A75 75 0 1 1 ${C(...TOP, 0)}`, arc(...LEFT, 69, 232), arc(...RIGHT, -52, 172),
  '128.0 26.1 C127.6 11.7 125.1 1.4 119.8 -7.7', '132.9 8.6 C137.1 -11.0 153.5 -19.2 174.1 -16.2 C169.0 2.4 151.5 12.7 132.9 8.6Z'];   // Stiel und Blatt
// Weg des laufenden Abschnitts: oben über den Kreis, rechts hinunter, links wieder hinauf –
// je Bogen ein eigener Pfad, zeitlich versetzt (Keyframes ld-top/-right/-left in style.css), damit er nahtlos weiterläuft
const RUN = [['top', arc(...TOP, 180, 380)], ['right', arc(...RIGHT, -52, 120)], ['left', arc(...LEFT, 69, 232)]];

export const LOADER = `<svg class="loader" viewBox="0 -30 256 286" role="img" aria-label="Lädt">
  ${BASE.map((d) => `<path class="ld-base" d="M${d}" pathLength="100"/>`).join('')}${RUN.map(([k, d]) => `<path class="ld-run ld-${k}" d="M${d}" pathLength="100"/>`).join('')}</svg>`;

// klein unten in der Mitte, solange etwas lädt (erst nach kurzer Zeit, damit es bei schnellen Antworten nicht flackert)
let open = 0, timer = 0, el = null;
export async function busy(task) {
  if (++open === 1) timer = setTimeout(() => {
    el ??= Object.assign(document.createElement('div'), { className: 'busy', innerHTML: LOADER });
    document.body.appendChild(el);
  }, 350);
  try { return await task; } finally {
    if (--open === 0) { clearTimeout(timer); el?.remove(); }
  }
}
