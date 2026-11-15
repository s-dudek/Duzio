// Anmeldung (nur Login – Konten gibt es schon aus der Übersicht, Registrierung ist abgeschaltet)
import { ctl } from './control.js';
import { $app, esc, sb, state } from './core.js';
import { loadAll } from './data.js';
import { ICON, LOGO_MARK } from './icons.js';
import { LOADER } from './loader.js';
import { closeSheet } from './sheet.js';
import { splashReady } from './splash.js';

export const BRAND = `<span class="brand">${LOGO_MARK}<span class="brand-w">duzio</span></span>`;

function renderAuth(message = '', isError = false) {
  ctl.show(false);
  $app.innerHTML = `
  <div class="lg-page">
    <header class="band lg-band">
      <div class="lg-logos"><span class="ln"></span><span class="sl"></span>${BRAND}<span class="sl r"></span><span class="ln"></span></div>
    </header>
    <main class="lg-main">
      <h1>Login</h1>
      <form id="auth-form" class="lg-form" novalidate>
        <div class="lbox">
          <input name="email" type="email" placeholder="E-Mail" autocomplete="email" autocapitalize="off" required>
          <hr>
          <input name="password" type="password" placeholder="Passwort" autocomplete="current-password" required>
        </div>
        <div class="lg-msg ${isError ? 'err' : ''}" role="status">${esc(message)}</div>
        <button class="lg-go" type="submit" aria-label="Anmelden">${ICON.arrow}</button>
      </form>
      ${window.__DEMO ? '<button class="tipl" type="button" data-demo>Demo-Zugang</button>' : ''}
    </main>
    <footer class="band lg-ftr"></footer>
  </div>`;
  splashReady();
  $app.querySelector('[data-demo]')?.addEventListener('click', () => sb.auth.signInWithPassword({ email: 'simon@demo.at', password: 'demo123' }));
  $app.querySelector('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = String(f.get('email') || '').trim(), password = String(f.get('password') || '');
    if (!email.includes('@')) return renderAuth('Bitte gib eine gültige E-Mail-Adresse ein.', true);
    if (password.length < 6) return renderAuth('Das Passwort braucht mindestens 6 Zeichen.', true);
    e.target.querySelector('.lg-go').disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) renderAuth(translateAuthError(error), true);
  });
}

function translateAuthError(e) {
  const m = (e.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-Mail oder Passwort falsch.';
  if (m.includes('not confirmed')) return 'Bitte zuerst die E-Mail bestätigen.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Keine Verbindung. Bitte Internet prüfen.';
  if (m.includes('rate limit')) return 'Zu viele Versuche. Bitte kurz warten.';
  return 'Anmeldung fehlgeschlagen.';
}

export function initAuth() {
  sb.auth.onAuthStateChange((event, session) => {
    const uid = session?.user?.id || null;
    if (uid === state.me) return;
    state.me = uid;
    if (uid) {
      $app.innerHTML = `<div class="center loading">${LOADER}</div>`;
      setTimeout(loadAll, 0);   // ausserhalb des Auth-Callbacks (vermeidet Blockieren in supabase-js)
    } else {
      closeSheet();
      state.loaded = false;
      renderAuth();
    }
  });
  sb.auth.getSession().then(({ data }) => { if (!data.session) renderAuth(); });
}
