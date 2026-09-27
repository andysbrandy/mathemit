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

## 7.3.2 bis 7.3.5 — Clip bauen

Nach dem Auswählen wird der Clip in vier Stufen erzeugt. Jede Stufe hat einen eigenen Beleg, und bricht eine ab, laufen die folgenden nicht:

```bash
# Alles in einem Lauf (Auswahl → Frames → MP4 → Gegenprobe)
npm run e2e -- --seed wochenserie-01 --count 3

# Mit Hook-Vorlage (P7.4.1)
npm run e2e -- --seed wochenserie-01 --count 3 --hook countdown

# Einzelne Stufen
npm run preview -- --index 0          # Standbild der Aufgabe
npm run frames  -- --index 0          # 9:16-Frames, 30 fps
npm run video                            # Frames → MP4
npm run verify:clip                      # Gegenprobe am fertigen Clip

# Abnahme
npm run test:pipeline
```

## 7.4 — Hook-Vorlagen

Fünf Vorlagen, ausgewählt mit `--hook <name>`. Die Reihenfolge ist überall gleich (Frage → Reveal → Denkpause → Auflösung → Endcard), variiert werden Eyebrow, Hook-Text und die Denkpause.

| Vorlage | Dauer | Aufbau | Einsatz |
|---|---|---|---|
| `frage` | 16 s | Standard, ohne Zusatz | Classic; **bisheriges Verhalten, bytegleich** |
| `countdown` | 19 s | 5-s-Pause mit sichtbarem Timer 5→1 | „Kannst du das in 5 Sekunden lösen?" |
| `erwachsenen` | 16 s | Eyebrow „Mittelschul-Niveau" | „Können Erwachsene das?" |
| `streak` | 16 s | Eyebrow „Streak" | Konkurrenzmoment, ohne echte Nutzerdaten |
| `vorher-nachher` | 18 s | zusätzliches Segment „Schulweg" vor dem Blueprint | „So erklärt's die Schule vs. so macht's die App" |

Zwei Punkte, die bewusst so gelöst sind:

- **Der Countdown zählt dieselbe Zahl herunter, die der Hook verspricht.** Ein Hook, der „10 Sekunden" ankündigt, während sichtbar „3" steht, ist der häufigste Fehler in solchen Clips. 5 s Pause statt 10 s — 10 s wären zwar im Zeitfenster, aber ein echter Retention-Killer.
- **Ohne `--hook` bleibt alles bytegleich.** `frage` ist exakt der Ablauf aus 7.3.5; das ist als Test festgeschrieben, nicht nur behauptet.

## 7.4 — Freigabe per Link

Nach `npm run queue` liegt fertiges Material in `work/queue/`. Der Review-Server zeigt es im Browser und nimmt die Freigabe per Klick entgegen:

```bash
npm run queue      # Material erzeugen
npm run review     # Freigabe-Server starten
```

Beim Start erscheinen zwei Links: `localhost` für den Rechner und die IP für das **Handy im selben WLAN**. Der Token steht im Link — ohne ihn zeigt der Server nichts.

**Grenzen, die wichtig sind:**

- **Nur im eigenen Netz.** Der Server bindet auf alle Schnittstellen, damit der Handy-Link funktioniert. Es gibt keine Anmeldung, weil es keine Nutzer gibt.
- **Nichts wird veröffentlicht.** Der Server liest und schreibt nur innerhalb von `work/queue/` und ruft keine Plattform auf. Das Posten bleibt manuell.
- **Die Freigabe läuft über dieselbe Funktion wie `--release`.** Der Server kann also nichts freigeben, was das Skript nicht auch freigeben würde. Eine unvollständige Episode zeigt keinen Knopf und lehnt auch einen erzwungenen Klick ab.
- Beenden mit Strg-C. Es gibt keinen Dienst und keinen Watchdog.

## 7.5 — Videowerkstatt (GUI)

`npm run review` startet nicht nur die Freigabeliste, sondern eine Oberfläche, in der sich der ganze Ablauf bedienen lässt:

```bash
npm run review
```

Im Browser (Link aus dem Terminal, funktioniert auch am Handy im WLAN):

- **Clip erzeugen** — Seed (leer = heute), Hook-Vorlage, Aufgabenzahl. Dauert etwa eine Minute.
- **Status** — läuft / bereit / kein Clip, dazu ffmpeg- und Chrome-Verfügbarkeit, Frame-Zahl, Dauer, Format und ob gegengeprüft wurde.
- **Vorschau** — der fertige Clip läuft direkt im Player, ohne ihn erst herunterladen zu müssen.
- **Protokoll** — die Ausgabe des Laufs, live mitlaufend.
- **Queue** — alle Episoden mit Status, Klick führt zur Freigabeseite.

Nach dem Lauf liegt das Material automatisch in der Queue; freigegeben wird weiterhin **manuell** auf der Freigabeseite.

Drei Eigenschaften, die bewusst so gebaut sind:

- **Es läuft immer nur ein Auftrag.** Ein zweiter Klick wird abgelehnt — zwei gleichzeitige Läufe würden in dieselben `work/`-Ordner schreiben und den ersten zerstören.
- **Der Abbruch beendet auch die Browserprozesse.** Der Lauf startet selbst Chrome; abgeschickt wird deshalb an die ganze Prozessgruppe, sonst liefe Chrome im Hintergrund weiter.
- **Alles Angezeigte steht in einer Datei.** Die Oberfläche rechnet nichts nach, sie liest `pipeline-report.json` und `clip-manifest.json`. Deshalb stimmt sie auch nach einem Neuladen der Seite.

Nur die Freigabeliste ohne Steuerung: `npm run review -- --list-only`

## 7.3.6 — Queue und manuelle Freigabe

Aus einem belegten Lauf entsteht eine Queue-Episode mit Caption, Hashtags, Quellen-/Seed-Daten und den technischen Prüfergebnissen. Das MP4 wird in die Queue kopiert, damit ihr Bestand unabhängig vom Arbeitsordner bleibt.

```bash
# Episode anlegen (liest Vorgaben aus work/)
npm run queue

# Status ansehen
npm run queue -- --list content-pipeline/work/queue

# Manuell freigeben — zwingend ein eigener Schritt
npm run queue -- --release content-pipeline/work/queue/<slug>
```

**Es wird nichts veröffentlicht.** Das Skript kennt keinen Netzwerkpfad und keinen Upload; es schreibt ausschließlich Dateien unter `work/queue/`.

Drei Punkte, die die Abnahme tragen:

- **Unvollständig heißt nicht freigegeben.** Fehlt das MP4, ist der Lauf nicht gegengeprüft oder stimmt die Hash-Kette nicht, lautet der Status `unvollstaendig`, die Gründe stehen in `gaps`, und `--release` wird abgelehnt.
- **Die Hash-Kette wird an drei Gliedern geprüft** — Frames, Clip und Laufbericht müssen denselben Framesatz nennen. Sonst würde die Queue Zahlen zu einem Clip veröffentlichen, den es so nie gab.
- **Geschrieben wird atomar** (erst temporär, dann umbenannt). Ein Abbruch hinterlässt keine halbe Episode.

Aufbau einer Episode:

```
work/queue/<slug>/
  clip.mp4      # byteidentische Kopie des geprüften Clips
  episode.json  # Caption, Hashtags, Seed-Daten, Prüfergebnisse, Status
```
