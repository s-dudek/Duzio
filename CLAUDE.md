# Duzio – Hinweise für Claude

Persönliche Web-App (PWA) von Simon (Dudek Grafik) zum Kalorienzählen nach dem Vorbild von Yazio: Tagebuch mit Mahlzeiten,
kcal-Ziel und Makros, Wasser, Gewicht, Lebensmittel (eigene + Open Food Facts, Barcode), Rezepte mit Nährwerten, Einplanen,
automatische Einkaufsliste. Nur Simon nutzt sie (Daten privat je Konto).
Live: https://s-dudek.github.io/Duzio/ (GitHub Pages, Branch `main`). Backend: Supabase-Projekt `gerpilzxolufdnlsltxk`
(dasselbe wie die Übersicht, gleiche Anmeldung, eigene Tabellen `duzio_*`).

Aussehen und Aufbau sind von der Übersicht (Repo `s-dudek/uebersicht`) übernommen und sollen gleich bleiben.
Bei Gestaltungsfragen dort nachsehen (`style.css`, `CLAUDE.md`), Änderungen am gemeinsamen Grundgerüst in beiden Apps gleich halten.

## Zusammenarbeit
- Auf Deutsch antworten (österreichisch: Paradeiser, Erdäpfel …), kurz und sachlich, ohne lange Aufzählungen.
- Simon ist Grafiker, kein Programmierer: Ergebnisse in einfachen Worten erklären, keine Befehle zum Selbst-Ausführen, wenn Claude es selbst machen kann.
- Nach jeder fertigen Änderung: prüfen, committen, auf `main` pushen (GitHub Pages veröffentlicht nach 1–2 Minuten).
- Nie Konten anlegen oder Passwörter eingeben. Registrierung ist im Supabase-Projekt abgeschaltet; Duzio hat nur ein Login.

## Feste Regeln
- **Sicherheit zu 100 %.** Alles aus der Datenbank und von Open Food Facts vor der Anzeige mit `esc()` maskieren.
  Daten beim Laden prüfen (`cleanFood`, `cleanRecipe`, `cleanEntry` … in `js/data.js`), Zahlen nur über `num()`, Texte über `clean()`.
  Fremde Daten nie in Attribute schreiben, sondern über Schlüssel nachschlagen (siehe `ctx.picks` in `food-search.js`).
- CSP in `index.html` nicht aufweichen: keine Inline-Skripte, keine `on…`-Attribute, keine fremden Skript-Quellen.
  Verbindungen nur zu Supabase und `world.openfoodfacts.org`.
- Keine Geheimnisse ins Repository: kein `service_role`/secret Key. `config.js` enthält nur URL und Publishable Key.
- Sauberer, gut gegliederter Code ohne Wirrwarr: kleine Module, sprechende Namen, kurze deutsche Kommentare, keine toten Reste. Auf Effizienz achten.

## Aufbau (kein Build, ES-Module direkt ausgeliefert)
- `index.html`, `style.css` (nach Bereichen gegliedert, Farben in `:root`), `js/*.js`, `js/vendor/supabase.js` (lokal gebündelt, `npm run supabase`),
  `js/vendor/zxing.js` (Barcode-Erkennung, Apache 2.0, `npm run zxing`).
- Layout wie Übersicht: unter 1024 px Smartphone/Tablet (dunkelgrüne Kopfleiste 44 px, Leiste unten mit Aktionen, Steuerknopf unten rechts:
  tippen = Startseite), ab 1024 px Desktop mit Seitenleiste (`isDesktop()`), Aktionen rechts in der Kopfleiste.
- Fenster (Sheets, `sheet.js`): oben rechts runde Knöpfe aus `sheetActs()` – Bearbeiten, Speichern ✓, Schließen ✕, Löschen. Keine Knöpfe unten.
- Keine kleinen Beschreibungs-/Hinweistexte auf den Seiten.
- Module: `core.js` (Zustand, Helfer), `data.js` (Laden/Prüfen/Speichern), `nutri.js` (Bedarf nach Mifflin-St Jeor × Aktivität ± Ziel,
  Summen, Umrechnen), `widgets.js` (kcal-Ring, Makro-Balken, Wasser), `home.js` (Kacheln), `diary.js` (Tagebuch), `food-search.js`
  (Eintragen: Suche, Menge, Eintrag bearbeiten, kcal direkt), `off.js` (Open Food Facts), `barcode.js` (Kamera: BarcodeDetector des Browsers,
  sonst ZXing aus `js/vendor/zxing.js` – nur EAN/UPC, lokal gebündelt mit `npm run zxing`, erst beim Scannen geladen; so geht es auch am iPhone), `foods.js` (Lebensmittel), `recipes.js` (Rezepte, Einplanen,
  Bearbeiten), `shopping.js` (Einkaufsliste, aus dem Plan), `progress.js` (Gewicht, Woche), `profile.js` (Profil & Ziele), `import.js` (Code einfügen),
  `actions.js` (alle Klicks über `data-act`), `render.js`, `nav.js`, `control.js`, `auth.js`, `splash.js`, `loader.js`, `icons.js`.
- Startseite: Kacheln wie in der Übersicht (`.mt`, Größen s/m/l, Akzentfarbe `--ac`), feste Reihenfolge.
- Tagebuch-Einträge speichern die Nährwerte als Kopie (ändern sich nicht, wenn das Lebensmittel später geändert wird).
  Einträge an zukünftigen Tagen sind „geplant“ (`planned`): zählen nicht zur Tagessumme, sind Grundlage für „Einkauf → Aus Plan“;
  im Eintrag „Gegessen“ anhaken übernimmt sie.
- Lebensmittel von Open Food Facts werden beim ersten Eintragen bzw. als Favorit in `duzio_foods` gemerkt (`source: 'off'`).

## Code für Rezepte und Lebensmittel
Simon stellt mit Claude im Chat Rezepte zusammen bzw. schickt ein Rezept-Foto; Claude gibt einen Code aus, den Simon unter
Rezepte → „Code“ einfügt (`js/import.js`). Gleichnamige Rezepte werden ersetzt. Nährwerte immer **je 100 g**, Menge `g` in Gramm.
Wir kaufen beim Hofer ein: Zutaten/Mengen vorher mit Simon abstimmen.
```
DUZIO {
  "rezepte": [{ "titel", "portionen", "dauer_min", "tags": [], "hinweis", "zubereitung": ["Schritt", …],
                "zutaten": [{ "name", "g", "einheit": "z. B. 2 Stück", "abteilung", "kcal", "eiweiss", "fett", "kohlenhydrate" }] }],
  "lebensmittel": [{ "name", "marke", "einheit": "g|ml", "kcal", "eiweiss", "fett", "kohlenhydrate", "zucker", "ballaststoffe", "salz",
                     "portionen": [{ "name", "g" }] }]
}
```
Abteilungen: Obst & Gemüse, Brot & Backwaren, Kühlregal, Fleisch & Fisch, Tiefkühl, Trockenware & Konserven, Gewürze & Öle, Getränke, Süßes & Snacks, Drogerie & Haushalt, Sonstiges.

## Supabase
- Alle Datenbank-Änderungen als wiederholbares SQL (`if not exists`, `drop policy if exists`) unten an `supabase-setup.sql` anhängen.
- Jede Tabelle mit Row Level Security „eigene Zeilen“ (`owner_id = auth.uid()`).
- Neue Zeilen mit selbst erzeugter UUID einfügen, ohne `.select()` danach.
- Supabase ist als Connector verbunden (`apply_migration`); Bestätigungen bei Live-Änderungen klickt Simon selbst.
- Tabellen der Übersicht (`items`, `categories` …) nicht anfassen.

## Prüfen und veröffentlichen
1. `npm install` (einmalig), dann `node tools/lint.mjs` – muss „alles sauber“ melden.
2. Vorschau mit Beispieldaten: `npm run vorschau` → `demo/duzio-vorschau.html` (nicht im Repo; Login „Demo-Zugang“).
   `demo/mock-supabase.js` bildet Tabellen und Zugriffsregel nach, `demo/off-shim.js` ersetzt Open Food Facts: bei neuen Tabellen mitpflegen.
   Mit Playwright Bildschirmfotos bei 390 px, 820 px und 1280 px prüfen, Konsole auf Fehler.
   Simons Vorschau ist das Artifact https://claude.ai/artifact/L26frYHttsfJ3uGCsS7Job – mit der neu gebauten Datei aktualisieren (gleiche URL behalten).
3. In `sw.js` die Nummer bei `CACHE` erhöhen und neue Dateien in `FILES` eintragen.
4. Committen und auf `main` pushen.

## Stand und offene Punkte (November 2026)
- Version 1: Tagebuch, Eintragen, Open Food Facts, Barcode, Lebensmittel, Rezepte, Einplanen, Einkaufsliste, Fortschritt, Profil, Code-Import.
- Ideen für später: Kacheln der Startseite bearbeiten (wie Übersicht), Rezept-Fotos,
  Verbindung zur Übersicht (Wochenplan/Einkauf), Intervallfasten, Aktivitäten/Training als verbrannte kcal.
