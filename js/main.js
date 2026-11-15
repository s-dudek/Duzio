// Einstieg: alle Teile starten, sobald die Module geladen sind
import { initActions } from './actions.js';
import { initAuth } from './auth.js';
import { startControl } from './control.js';
import { onLayoutChange } from './core.js';
import { initSync } from './data.js';
import { render } from './render.js';
import { initSplash } from './splash.js';

initSplash();            // Startbild sofort zeigen
startControl();          // Steuerknopf anlegen (wird von der Ansicht benutzt)
initActions();           // Tippen und Absenden in der Hauptansicht
initSync();              // beim Zurückkehren in die App neu laden
initAuth();              // Anmeldung prüfen, dann Daten laden
onLayoutChange(render);  // Fenster breiter/schmaler: Smartphone- bzw. Desktop-Layout

// Offline-Zwischenspeicher
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
