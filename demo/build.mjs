// Baut aus den echten App-Dateien eine einzelne Vorschau-Seite mit Beispieldaten.
// Statt Supabase läuft die Beispiel-Datenbank (mock-supabase.js), statt Open Food Facts Beispielprodukte (off-shim.js).
// Aufruf: npm run vorschau
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const result = await build({
  entryPoints: [path.join(root, 'js/main.js')],
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  plugins: [{
    name: 'vorschau-ersatz',
    setup(b) {
      b.onResolve({ filter: /vendor\/supabase\.js$/ }, () => ({ path: path.join(root, 'demo/supabase-shim.js') }));
      b.onResolve({ filter: /\/off\.js$/ }, () => ({ path: path.join(root, 'demo/off-shim.js') }));
    },
  }],
});

const html = `<!doctype html>
<meta charset="utf-8">
<title>Duzio</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap">
<style>
${read('style.css')}
:root { --safe-top: 0px; --safe-bottom: 0px; }
</style>
<div id="splash" class="splash" aria-hidden="true"></div>
<div id="app"><div class="center muted">Lädt …</div></div>
<div id="sheet-root"></div>
<div id="toast" class="toast" hidden></div>
<script>window.APP_CONFIG = { SUPABASE_URL: 'demo', SUPABASE_KEY: 'demo' };</script>
<script>
${read('demo/mock-supabase.js')}
</script>
<script type="module">
${result.outputFiles[0].text}
</script>
`;
const out = path.join(root, 'demo/duzio-vorschau.html');
fs.writeFileSync(out, html);
console.log('geschrieben:', out, html.length, 'Bytes');
