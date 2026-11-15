# Duzio

Persönliche Web-App (PWA) zum Kalorienzählen nach dem Vorbild von Yazio: Tagebuch mit Frühstück, Mittag, Abend und Snacks,
kcal-Ziel aus den Körperdaten, Makros, Wasser, Gewicht, Lebensmittel-Suche (eigene und Open Food Facts, Barcode),
Rezepte mit Nährwerten, Einplanen und automatische Einkaufsliste. Aussehen und Aufbau wie die App „Übersicht“.

Läuft auf GitHub Pages, Daten und Anmeldung in Supabase. Kein Build-Schritt: die Dateien werden so ausgeliefert, wie sie hier liegen.

## Aufbau

```
index.html        Seitengerüst, Sicherheitsrichtlinie (CSP)
config.js         Supabase-Adresse und öffentlicher Schlüssel (darf öffentlich sein)
style.css         Gestaltung, nach Bereichen gegliedert
sw.js             Service Worker (Offline-Zwischenspeicher)
supabase-setup.sql  Tabellen und Zugriffsregeln (wiederholbar)
js/               Module, Übersicht in CLAUDE.md
demo/             Vorschau mit Beispieldaten (npm run vorschau)
tools/lint.mjs    Prüft Importe aller Module
```

## Sicherheit

- Row Level Security: jede Person sieht nur eigene Zeilen.
- Alle Texte aus der Datenbank und von Open Food Facts werden geprüft und vor der Anzeige maskiert.
- Content-Security-Policy: Skripte nur von dieser Seite, Verbindungen nur zu Supabase und Open Food Facts.
- Die Supabase-Bibliothek liegt fest im Projekt statt von einem CDN zu kommen.

Lebensmitteldaten: © Open Food Facts-Mitwirkende, Lizenz ODbL (https://world.openfoodfacts.org).
