# Content-Pipeline (P7.3)

Dieser Ordner erzeugt lokal und ohne Netzwerkzugriff reproduzierbare Aufgabenpakete für die spätere Video-Pipeline. **Die Pipeline veröffentlicht nichts automatisch.**

## 7.3.1 — Aufgaben auswählen

Voraussetzung: Node.js (im Projekt bereits vorhanden; alternativ eine aktuelle LTS-Version).

```bash
cd content-pipeline

# Reproduzierbares Beispiel mit 3 Aufgaben der Stufe „Training“
npm run select -- --seed wochenserie-01 --difficulty 2 --count 3

# Ausgabe nur ins Terminal (z. B. zum Prüfen)
npm run select -- --seed wochenserie-01 --difficulty 2 --count 3 --stdout

# Eine feste Auswahl aus drei bis fünf bekannten Generator-Keys
npm run select -- \
  --seed wochenserie-02 \
  --difficulty 3 \
  --generators dreieckFlaeche,gleichungEinfach,bruchAddition

# Alle 47 Generatoren einmal aufdecken (für einen Vollständigkeitstest)
npm run select -- --seed generator-matrix --difficulty 1 --all-generators --stdout

# Abnahme: Determinismus, 47 Generatoren × 3 Stufen, Fehler und Dateiausgabe
npm test
```

Ohne Optionen entsteht `content-pipeline/work/episode.json`, unabhängig davon, ob der Befehl im Repository-Wurzelverzeichnis oder in `content-pipeline/` gestartet wird. Das gesamte `work/`-Verzeichnis ist absichtlich in `.gitignore`, damit keine Aufgabe mit zufälligem Fortschritt oder personenbezogenen Daten versehentlich committed wird.

## Reproduzierbarkeit

- Gleiche Optionen **und derselbe Seed** erzeugen byteidentisches JSON.
- Der Seed bestimmt die Reihenfolge der ausgewählten Generatoren und wird zusätzlich in `app-base.js` für die Zufallswerte der Aufgaben verwendet.
- Kein `Date`, keine Systemuhr und kein Netzwerk fließen in die Ausgabe ein.
- Es werden nur die Generatorfunktionen aus `app-base.js` aufgerufen. Die normale Lern-App wird nicht gestartet; es gibt keine Anmeldung und keinen Fortschritts-Write.

## Aufgaben-Datenträger

Jede Episode enthält:

- Metadaten (`schemaVersion`, Seed, Stufe, Anzahl)
- Generator-Key, Thema und Lehrplanbezug
- Frage, Hinweis, Antwort, Erklärung und gegebenenfalls Auswahlmöglichkeiten
- Input-Typ, Einheit und Toleranz
- Badge und unverändertes SVG für die spätere Blueprint-Szene

Weitere Arbeitspakete bauen darauf auf: Browser-Übergabe (7.3.2), vertikales Rendering (7.3.3), ffmpeg (7.3.4), Hook/Endcard (7.3.5) und Queue/Freigabe (7.3.6).
