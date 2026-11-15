// Speichert die App-Dateien, damit sie auch bei schlechtem Netz schnell startet.
// Bei jeder neuen Version die Nummer erhöhen und neue Dateien in FILES eintragen.
const CACHE = 'duzio-v2';
const FILES = [
  './', 'index.html', 'style.css', 'config.js', 'manifest.json',
  'icons/icon-192.png', 'icons/apple-touch-icon.png',
  'js/actions.js',
  'js/auth.js',
  'js/barcode.js',
  'js/control.js',
  'js/core.js',
  'js/data.js',
  'js/dates.js',
  'js/diary.js',
  'js/food-search.js',
  'js/foods.js',
  'js/home.js',
  'js/icons.js',
  'js/import.js',
  'js/loader.js',
  'js/main.js',
  'js/nav.js',
  'js/nutri.js',
  'js/off.js',
  'js/profile.js',
  'js/progress.js',
  'js/recipes.js',
  'js/render.js',
  'js/sheet.js',
  'js/shopping.js',
  'js/splash.js',
  'js/widgets.js',
  'js/vendor/supabase.js',
  'js/vendor/zxing.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Eigene Dateien: zuerst Netz (am Browser-Zwischenspeicher vorbei, damit neue Versionen sofort da sind), sonst Cache.
// Supabase und Open Food Facts nie cachen.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
