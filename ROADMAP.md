# 🗺️ Mathemit — Roadmap zur besten Mathe-Lern-App in Österreich

> Stand: laufende Version siehe App-Footer bzw. VERSION-Datei | Ziel: Vollständige Lehrplan-Abdeckung (AHS/MS 2023) mit pädagogischem Support + Feedback-Loop

## 📊 Aktueller Stand

- **47 Generatoren in 15 lehrplangetreuen Themen-Modi** (H1–H4/I1–I3):
  Dreiecke, Vierecke, Winkel, Umfang & Fläche, Kreis, Körper (Volumen), Oberfläche, **Brüche (8 Operationen inkl. gemischte Zahlen & Bruch↔Dezimal)**, Brüche & Prozent, **Prozente & Zinsen (NEU)**, Textaufgaben (inkl. mehrstufig), Alltag in Österreich (inkl. mehrstufig), **Gleichungen & Verhältnisse** (inkl. Proportionalität), **Daten & Diagramme (NEU: Tabellen + Säulendiagramm)**
- **3 Schwierigkeitsstufen** je Generator (🌱/🎯/🚀) + dynamische Anpassungs-Vorschläge
- **Pädagogisches Tipp-System**: progressive Offenlegung (Andeuten → Formel/Ansatz) + gezielte Korrekturhinweise bei Fehlern
- **Wiederholungstraining**: falsch gelöste Aufgaben werden exakt gespeichert und über den 🔁-Chip der Reihe nach wiederholt (bis alle geschafft sind)
- **In-App Feedback-Feature**: 💬-Button (nach 10 s) → Modal → POST an `backend/feedback.php` (Token serverseitig via `GH_FEEDBACK_TOKEN`) → GitHub-Issue mit Label `feedback` (Aufgabe + Feedbacktext + Timestamp)
- **Automatische KI-Feedback-Analyse** (GitHub Actions, kostenlos):
  - Freitags 11:00 UTC (= 12:00 CET): Wochen-Summary mit **🤖 Entwicklungsprompt** (`scripts/weekly_summary.py`) + Benachrichtigungs-Issue (→ Mail) — die gesamte Woche wird in EINEM KI-Aufruf ausgewertet
  - KI-Kette: GitHub Models → HF-Router (dynamische Modell-Erkennung via `/v1/models`) → Pollinations (keyless)
- **Österreichischer Lehrplan-Mapping** (Codes H1–H3, I1–I3)
- **Endlose Stufen + Eulenhain** (P6): Jede Stufe schaltet eine eigene Eule frei (eigene Farbwelt + eigene kleine Animation) — gesammelt auf einem wachsenden Baum im 🦉-Menü; dauerhaft gespeichert
- **Spaced Repetition (Wissens-Ampel)** — P4.3: Jeder Generator bekommt eine Ampel: 🔴 (≥1 fällige Wiederholung) > 🟡 (Einträge vorhanden) > 🟢 (keine). Rote Modi haben Priorität bei der Aufgabenwahl.
- **Dynamische Lobsprüche** — P4.4: Serien-Meilensteine, Level-Ehrung und Wiederholungs-Triumph-Feedback via `getMotd()`.
- **Wissensgarten (Kompetenz-Bäume)** — P4.1: 6 Bäume je Lehrplanbereich, Äpfel färben sich nach Reife (hellgrün → gelb → orange → rot), goldene Bäume ziehen Tiere an; Klick auf eine Frucht startet gezieltes Training.
- **Streaks, Basis-Badges, Auth-System**
- **Comic-SVG-Engine** (gerundete Silhouetten, dynamische Skizzen)
- **Geometrisches Eulen-Logo**: blinkt, die Pupillen folgen dem Cursor, die Flügel wedeln bei richtigen Aufgaben („Bewegung reduzieren" wird respektiert)
- **9 Alltag-Textaufgaben** mit Österreich-Bezug
- **Qualitätssicherung**: Pre-Commit-Check gegen nicht deklarierte Variablen (`scripts/check-strict-vars.py`) — verhindert „ReferenceError: Can't find variable"-Abstürze im `use strict`-Code der App
- **PWA (installierbar & offline)** — P5.2 Grundversion: App per „Zum Home-Bildschirm" installierbar, startet ohne Netz mit allen 47 Generatoren, Icons aus `logo.svg`. Fortschritt geht offline **nur lokal** — die DB-Nachreichung ist bewusst noch nicht gebaut und wird auch nicht behauptet.
- **Aufgabenleiste per Maus scrollbar** (Bugfix Windows/Edge): Die Themenleiste ließ sich mit der Maus überhaupt nicht bewegen — ein senkrechtes Mausrad scrollte die Seite, nicht die Leiste. Auf Touchpads fällt das nicht auf, auf Windows mit Maus umso mehr. Ursache war `overflow-x:auto` bei gleichzeitig `overflow-y:visible`, wodurch der Browser `overflow-y` zu `auto` rechnet; Chromium leitet das Rad dann an die Seite weiter. Behoben mit explizitem `overflow-y:hidden` **und** einem Wheel-Handler, der das senkrechte Rad auf die Leiste umleitet. Am Anschlag wird nichts geschluckt (die Seite scrollt weiter), Strg+Rad bleibt Zoom, eine echte seitliche Trackpad-Geste bleibt unangetastet. Dazu Pfeiltasten und `role="group"` für Tastatur und Screenreader.

---

## 🏔️ Die Prioritäten (P1–P11)

### P1 — Lehrplan-Abdeckung *(größter Hebel)*

| # | Thema | Lehrplan-Code | Status |
|---|-------|---------------|--------|
| 1.1 | Lineare Gleichungen lösen (ax+b=c) | H2.I1 | ✅ |
| 1.2 | Tabellen lesen (Zuordnung) | I3.M1 | ✅ |
| 1.3 | Säulendiagramme lesen | I3.M1 | ✅ |
| 1.4 | Gemischte Zahlen (1 ¾) | H1.I1 | ✅ |
| 1.5 | Bruch ↔ Dezimal-Umrechnung | H1.I1 | ✅ |
| 1.6 | Zinsrechnung / Prozent-Satz | H1.I2 | ✅ |
| 1.7 | Proportionalität (Schattenlänge) | H2.I2 | ✅ |
| 1.8 | Mehrstufige Sachaufgaben (Rechenweg) | I1.M1 | ✅ |
| 1.9 | Satz des Pythagoras | H3 | ✅ |
| 1.10 | Ganze/negative Zahlen (ℤ) | H1 | ⬜ |
| 1.11 | Mittelwert / Median / Modus | I3 | ⬜ |
| 1.12 | Einfache Wahrscheinlichkeit | I3 | ⬜ |
| 1.13 | Einheiten-Umrechnung (Länge/Masse/Zeit/Geld) | H2 | ⬜ |
| 1.14 | Weitere 3D-Körper (Pyramide, Kegel, Kugel, Prisma) | H3 | ⬜ |
| 1.15 | Potenzen & Wurzeln (Basis) | H1/H2 | ⬜ |
| 1.16 | Teilbarkeit, Primzahlen, kgV/ggT | H1 | ⬜ |
| 1.17 | Terme vereinfachen / Distributivgesetz | H2 | ⬜ |

### P2 — Schwierigkeitsgrade & Differenzierung

| # | Schritt | Status |
|---|---------|--------|
| 2.1 | 3 Stufen pro Generator (Einstieg/Training/Anforderung) | ✅ 48/48 (Erkennen/Eigenschaften: template-basiert, stufenunabhängig) |
| 2.2 | Dynamische Anpassung (Stufen-Wechsel) | ✅ (2× falsch in Folge → ⬇️-Button, 3× richtig in Folge → ⬆️-Button; ein Klick wechselt direkt die Stufe, beide Richtungen) |

### P3 — Pädagogischer Support

| # | Schritt | Status |
|---|---------|--------|
| 3.1 | 3-stufiges Tipp-System (Andeuten → Formel → Rechenweg) | ✅ Progressiv (💡-Button: Andeuten → Formel/Ansatz) |
| 3.2 | Fehler-Feedback mit gezielter Korrektur-Hinweis | ✅ Topic-Korrekturhinweis (🧭 Merke) bei falscher Antwort |
| 3.3 | In-App Feedback geben (Nutzer → GitHub-Issue) | ✅ 💬-Button + `backend/feedback.php`-Proxy (Token serverseitig) |
| 3.3a | Wöchentliche KI-Auswertung (Entwicklungsprompt + Mail) | ✅ `weekly-summary.yml` (Freitag 12:00 CET) + `weekly_summary.py` — EIN KI-Aufruf für die ganze Woche; Mail garantiert via Resend (Secrets `RESEND_API_KEY` + `MAIL_TO`), Bericht auch bei 0 Feedbacks |

### Feedback-Loop (Wochenrhythmus)

1. Nutzer gibt über 💬 Feedback → Issue mit Label `feedback`
2. Freitag 12:00 CET: KI fasst die Woche zusammen + formuliert Entwicklungsprompt → Issue wird zugewiesen (Mail)
3. Entwicklungsprompt hier einfügen → fachliche Bewertung → sinnvolle Punkte umsetzen
   - ⚠️ KI-Interpretationen prüfen (z. B. W37: „nur gleiche Nenner" war falsch verstanden — richtig: Brüche auf gemeinsamen Hauptnenner erweitern)

### P4 — Gamification & Motivation

| # | Schritt | Status |
|---|---------|--------|
| 4.1 | **Wissensgarten** (Kompetenz-Bäume je Lehrplanbereich, eigene Seite wie der Eulenhain) | ✅ 6 Bäume (Brüche, Prozente, Formen, Messen, Alltag, Struktur) — 47 Generatoren als Äpfel, Reife-Färbung aus der Spaced-Leiter (hellgrün/gelb/orange/rot), „fällig" als weicher Hellgrün-Lichtschein statt Uhr, Baum wächst mit Beherrschung, Tiere ziehen in goldene Bäume, Klick auf eine Frucht = gezielter Fokus-Übungsmodus; keine neuen DB-Felder (lebt von `progress.spaced`) |
| 4.2 | Wöchentliche Ziele | ✅ 3 Ziele (🎯 50 Punkte · 📚 20 Aufgaben · 🔁 5 Wiederholungen), ISO-Wochenstart montags, Fortschrittsbalken, +30 Bonus-Punkte bei allen 3 Zielen; gespeichert lokal + DB (`progress.goals`) |
| 4.3 | Wiederholungstraining (falsch gelöste Aufgaben exakt wiederholen) | ✅ (Instanz-Speicherung inkl. Original-Grafik, lokal + DB, 🔁-Chip, Erfolgsmeldung) |

### P5 — Österreich-Bezug & Polish

| # | Schritt | Status |
|---|---------|--------|
| 5.1 | ~~Mehr Regionen (15+ Alltag-Generatoren)~~ | ❌ gestrichen — **bewusst nicht mehr nötig**. Der Bestand (10 Alltag-Generatoren: Wien, Wandern, Einkauf, Weihnacht, Schule, Schulheft, Eiscafé, Skikurs, Wandertag, mehrstufig) reicht für den Wochenbetrieb; mehr Inhalt ist kein Engpass. |
| 5.2 | PWA / Offline | ✅ vollständig (Punkte 1–5) |

**Was 5.2 jetzt kann (Grundversion, ohne Punkt 3):**

| Punkt | Status | Umsetzung |
|---|---|---|
| 1. Installierbarkeit | ✅ | `manifest.webmanifest` (standalone, Theme `#1FA294`) + Meta-Tags in `index.html`; Icons aus `logo.svg` erzeugt |
| 2. Offline-Start | ✅ | `sw.js` mit Stale-While-Revalidate-Kern; Navigation Network-First mit Cache als Notnagel, App-Code Network-First, Unveränderliches Cache-First |
| 3. **Offline-Write-Queue** | ✅ | Warteschlange in `localStorage`; wird beim Netzrückkehr, nach jeder gelösten Aufgabe und beim Anmelden gesendet |

**Punkt 3 im Detail — die Warteschlange.** Der Sync ist ein **voller Snapshot**,
kein Delta, und der Server überschreibt blind. Damit gibt es nichts
zusammenzuführen — es gibt nur die Frage „ist der Server aktuell?". Solange das
nicht sicher beantwortet ist, wird der Snapshot später erneut gesendet. Das ist
idempotent: zweimal denselben Snapshot schicken ändert nichts.

**Der gefährliche Moment war das Anmelden, nicht das Offline-Arbeiten.**
`loadProgressFromAPI()` hat den Server als Wahrheit behandelt und den lokalen
Stand überschrieben. Bei einem Gast-Stand ist das richtig. Bei offline
Gearbeitetem genau verkehrt: lokal liegt nachweislich etwas, das der Server noch
nicht hat — die Punkte wären beim Anmelden wegsortiert worden. Jetzt gilt:

| Lage | Was passiert |
|---|---|
| Warteschlange leer | Serverstand lädt (wie bisher) |
| Warteschlange, **gleiches** Konto | erst senden, **dann** Serverstand laden |
| Warteschlange, **anderes** Konto | gar nichts senden, gar nichts laden, Hinweis anzeigen |

Die letzte Zeile ist kein Sonderfall, sondern der wichtigste: Auf geteilten
Familienhandys ist ein Kontowechsel Alltag. Ohne Konto-Kennung würden die Punkte
eines Kindes auf das Konto eines anderen wandern.

Dazu vier Regeln, die jeweils einen Fehler verhindern:

1. **Nur eine Anfrage gleichzeitig.** Zwei parallele Posts könnten in falscher
   Reihenfolge ankommen (Serverstand 100 Punkte, dann 90) — stiller
   Fortschrittsverlust.
2. **Backoff 5s → 20s → 60s → 5min.** Statt im Sekundentakt zu versuchen.
3. **401/403 wird nicht endlos wiederholt.** Ein ungültiges Token muss durch
   einen neuen Login behoben werden, nicht durch Warten.
4. **Der Nutzer sieht es.** Der Chip zählt die wartenden Änderungen. Wer
   traubte vorher dem „wird lokal gespeichert"-Text, sonst hätte er
   wahrscheinlich wochenlang geglaubt, alles sei synchron.

**Nebenbei gefunden und behoben — ein stiller Datenverlust:** Die App sendet
`repeatQ` und `diff` seit Langem, aber `backend/progress.php` hatte sie nicht in
der Whitelist und `progress` hatte keine passenden Spalten. Das Wiederholungs-
training (🔁) und die Schwierigkeitsstufe waren damit **überhaupt nicht
geräteübergreifend** — während die Oberfläche genau das verspricht. Schema,
Whitelist und Ladelogik sind ergänzt.

> **⚠️ Migration nötig** (einmalig in phpMyAdmin, sonst fehlen die Spalten):
> ```sql
> ALTER TABLE progress ADD COLUMN repeat_q JSON NULL AFTER grade;
> ALTER TABLE progress ADD COLUMN diff TINYINT NULL AFTER repeat_q;
> ```
> Danach `backend/progress.php` auf den Server hochladen. **Ohne Migration
> laufen die Posts mit einem SQL-Fehler und der Sync bleibt in der
> Warteschlange** — die App funktioniert weiter, nur nichts kommt an.
| 4. Update-Flow | ✅ | „♻️ Neue Version verfügbar"-Toast, wenn ein neuer Worker wartet; lädt aber **nicht** von selbst, weil das mitten in einer Aufgabe den Rechenweg zerstört |
| 5. Online-bleibt-Online | ✅ | Offline-Chip; ohne Netz meldet die API „Netzwerkfehler", und wartende Änderungen werden gezählt statt verschwiegen |

**Warum Punkt 3 offen bleibt und nicht „irgendwann" heißt:** Offline-Training landet
in `localStorage`, die DB-Synchronisation gibt es erst mit dem Queue-Bau. Solange
das fehlt, ist der Fortschritt eines Offline-Nutzers **nicht** in der DB und geht
auf einem anderen Gerät verloren. Der Chip sagt deshalb bewusst „wird **lokal**
gespeichert" und nicht „Alles gespeichert". Das ist kein Makel, sondern die
ehrliche Aussage — der Konflikt-Lösungsfall (lokal vs. DB, Reihenfolge,
Wiederholung) ist der teuerste Teil der ganzen Roadmap.

> ✅ **Erledigt** — siehe die Tabelle oben. Der Chip zeigt jetzt nicht mehr nur
> „wird lokal gespeichert", sondern zählt die wartenden Änderungen und verschwindet,
> sobald sie oben sind.

**Was der Service Worker bewusst NICHT tut — und warum:**

1. **Er cachet keine Backend-Antworten.** Ein gecachter Fortschritt wäre stiller
   Datenverlust: lokal da, in der DB nicht, und der Nutzer glaubt, alles sei
   gespeichert. Festgeschrieben als Test.
2. **Er spielt keine alte `app-base.js` aus, ohne zu fragen.** Cache-First gilt nur
   für Unveränderliches (Icons, Logo, Manifest). App-Code ist Network-First —
   sonst würde die App wochenlang mit altem Code laufen.

**Der Cache-Name hängt an der Registrierungs-URL:** die Seite registriert
`sw.js?v=<VERSION>`. Bei jedem Deploy ist das eine andere URL, der Browser meldet
einen neuen Worker, alte Caches werden gelöscht. Ohne das läge nach drei
Deploys ein toter Cache nach dem anderen.

**Icons:** `scripts/make-pwa-icons.js` erzeugt 192/512 und eine maskable-Variante
aus `logo.svg`. Bewusst **nicht** `avatar.png` — das trägt das Wortzeichen
„mathemit .andybrandy.at", das bei 48×48 (Android-Icon-Größe) unlesbar ist und
nur als dunkles Rechteck ankäme. Für ein App-Symbol zählt die Silhouette.
Auch `apple-touch-icon` zeigt jetzt auf ein PNG: iOS rendert kein SVG.

### P7 — Bekanntmachung Zielgruppe 10–14 J. (revidiertes Konzept 🔄)

**Status: ✅ 7.3 abgeschlossen (alle sechs Arbeitspakete 7.3.1–7.3.6 grün; Veröffentlichung bleibt ein manueller Schritt)**

**Zielgruppe:** 10–14-Jährige in Österreich (MS/AHS-Unterstufe, 5./6. Klasse).

**Grundprinzip der Revidierung:** Alterslimits regeln die **Account-Erstellung**, nicht wer die Inhalte tatsächlich zu sehen bekommt (geteiltes Familien-Handy, kein Login zum Zuschauen, ältere Geschwister zeigen's weiter). Reichweite bei 10–14-Jährigen entsteht real über genau diese Kanäle — unabhängig vom offiziellen Mindestalter.

#### 📋 Schritte (Checkliste)

| # | Schritt | Status |
|---|---------|--------|
| 7.1 | Link-Vorschauen: OG-/Twitter-Tags + Canonical + `og-image.png` (1200×630) in `index.html` | ✅ |
| 7.2 | Kanäle anlegen: YouTube (Shorts), TikTok, Instagram — URLs & Handles hinterlegt in `CHANNELS.md` | ✅ |
| 7.3 | Video-Pipeline-MVP: Puppeteer (headless) → Blueprint-Reveal → ffmpeg 9:16 (15–25 s) → Overlay + Endcard → Warteschlange | ✅ 6/6 Pakete |
| 7.4 | Hook-Bibliothek: 4 Formate (Countdown, Erwachsenen-Challenge, Streak-Flex, Vorher/Nachher) als Vorlagen + Freigabe per Link | ✅ 7.4.1–7.4.3 + Freigabelink + **erste Posts live (7.4.4–7.4.6)** |
| 7.5 | Wöchentlicher Rhythmus: 30-Sek.-Freigabe → Cross-Post auf 3 Kanäle (~1 Std./Woche) | ✅ Werkzeugkette (`weekly.js`) + [`WOCHENRUNBOOK.md`](content-pipeline/WOCHENRUNBOOK.md) — Posting bleibt manuell |
| 7.6 | Schutz & Recht: Kommentare bei Kinder-Content moderieren/deaktivieren; bezahlte Ads nur ab 13 (EU/AT) | ✅ je Plattform entschieden |
| 7.7 | Phase 2: Klassen-Code aktiv bewerben, Lehrer-Netzwerke, SEO-Seiten, Pinterest, Newsletter | ⏳ Phase 2 |

#### 🔄 Priorisierung der Kanäle

| Priorität | Kanal | Warum an dieser Stelle |
|---|---|---|
| **1** | **YouTube Shorts** | Höchste De-facto-Reichweite bei Kids ohne eigenen Account nötig (Algorithmus spielt nach Interesse, nicht nach Alter); Google-Auffindbarkeit als Bonus |
| **1 (gleichrangig)** | **TikTok** | Schnellster Cold-Start für virale Reichweite (For-You-Page braucht keine Follower); Format passt perfekt zu „Mathe-Trick in 15 Sekunden“ |
| **2** | **Instagram Reels** | Gleicher Content wie oben, zusätzlicher Kanal, cross-postbar ohne Mehraufwand |
| **3** | **Klassen-Code-System aktiv bewerben** | Verstärker **nachdem** organische Reichweite da ist — nicht als Startpunkt |
| **Phase 2 (später)** | Lehrer-Netzwerke, SEO-Seiten, Pinterest, Newsletter | Auf später verschoben, nicht gestrichen |
| **Gestrichen** | GitHub Discussions als Reichweitenkanal | Bleibt technischer Feedback-Kanal, gehört nicht in die Wachstumsstrategie |

#### 🎬 Automatisierte Pipeline — Video statt Webseiten

Das native Format aller drei Top-Kanäle ist das Kurzvideo statt statischer Seiten — **ein Asset, dreifach verwertbar**.


#### 🧩 7.3 in Arbeitspakete zerlegt

Jedes Paket hat eine eigene Abnahme; erst nach erfolgreichem Test wird das nächste begonnen. Die Pipeline bleibt zunächst **lokal und ohne automatisiertes Posten**.

| Arbeitspaket | Inhalt | Abnahme | Status |
|---|---|---|---|
| **7.3.1** | **Deterministische Aufgaben-Auswahl als gemeinsames Fundament:** Seed und gewünschte Schwierigkeitsstufe vorgeben; pro Episode 3–5 echte Generatoren aus `GEN{}` aufrufen; vollständige Aufgabendaten (Frage, Antwort, Erklärung, Hinweis, Input-Typ, SVG) als versioniertes JSON ausgeben. | Zwei Läufe mit demselben Seed sind bytegleich; alle 47 Generatoren und 3 Stufen sind grundsätzlich auswählbar; ungültige Parameter ergeben einen klaren Fehler; keine App- oder Nutzerdaten werden verändert. | ✅ `select-exercises.js` + 7 Tests |
| **7.3.2** | **Browser-Datenübergabe:** Auswahl-JSON in einer isolierten Chrome-/Puppeteer-Szene an die reale App übergeben und eine gewählte Aufgabe sichtbar rendern; Login, gespeicherte Nutzerdaten und Nebenwirkungen vermeiden. | Der Browser rendert exakt die JSON-Aufgabe inklusive Blueprint-SVG; keine Anmeldung und kein Progress-Write; Fehler/Timeout brechen den Lauf ab. | ✅ `render-preview.js` + 4 Tests |
| **7.3.3** | **Deterministisches 9:16-Rendering:** definierte 1080×1920-Szene, feste Kamera, 30 fps und reproduzierbare Blueprint-Reveal-Frames einschließlich 2-Sekunden-Pause vor der Auflösung. | 1080×1920-Frames/Media ohne schwarze oder abgeschnittene Bereiche; gleicher Seed ergibt vergleichbare Frames; Daten und SVG erscheinen korrekt. | ✅ `render-frames.js` + `lib/timeline.js` + 15 Tests |
| **7.3.4** | **Video-Montage mit ffmpeg:** Frames zu 15–25 s zusammensetzen, fps/Codec/Aspect Ratio fixieren und Ausgabe für YouTube Shorts, TikTok und Reels vorbereiten. | Valider MP4 (H.264/AAC, 1080×1920, 9:16, planbar 15–25 s), `ffprobe` bestätigt die Spezifikationen; ffmpeg-Fehler brechen den Lauf ab. | ✅ `assemble-video.js` + `lib/ffmpeg-runner.js` + 7 Tests |
| **7.3.5** | **Hook, Lösung und Endcard:** erste Hook-Vorlage mit Frage, 2 s Denkpause, Blueprint-Reveal und Lösung; anschließend Marken-Endcard mit App-Name und `https://mathemit.andybrandy.at/`. | Vollständiger 15–25-s-Clip mit lesbarem Hook, sichtbarer Lösung und 2–3 s Endcard; keine unlesbar gekürzten Texte. | ✅ `run-pipeline.js` + `verify-clip.js` + 12 Tests |
| **7.3.6** | **Metadaten, Warteschlange & manuelle Freigabe:** Caption, Hashtags, Quellen-/Seed-Daten und technische Prüfergebnisse erzeugen; Ergebnis atomar in eine lokale Queue schreiben. **Kein automatisches Posten.** | Jede Queue-Episode enthält MP4, Caption, Hashtags und Manifest; unvollständige Dateien gelten nicht als freigegeben; ein manueller Freigabeschritt bleibt zwingend. | ✅ `queue-episode.js` + 8 Tests |

**Ergebnis von 7.3:** Derselbe deterministische Aufgaben-Input muss mehrfach dieselbe 9:16-Datei mit Freigabedaten erzeugen. Plattform-Uploads bleiben ein manueller Schritt.

##### 📦 Was 7.3 konkret ermöglicht

7.3 ist kein „Video-Skript", sondern eine **belegte, reproduzierbare Kette**. Jede Stufe schreibt ihr Ergebnis auf die Platte, und der Beleg der einen Stufe ist die Eingangsbedingung der nächsten. Bricht eine ab, laufen die folgenden nicht — es entsteht kein scheinbar gültiges Ergebnis.

**Die Kette im Überblick** (`content-pipeline/`, ~5.100 Zeilen inkl. Tests):

```
select-exercises.js  ──▶  work/episode.json          Auswahl: 3–5 Aufgaben, Seed, Stufe
render-frames.js     ──▶  work/frames/              480 PNGs, 1080×1920, 30 fps
assemble-video.js    ──▶  work/video/clip.mp4       H.264, 9:16, 16 s
verify-clip.js       ──▶  CLIP_CHECK_OK             Gegenprobe aus dem MP4 selbst
run-pipeline.js      ──▶  work/pipeline-report.json Auswahl → Frames → Clip, Hash-Kette
queue-episode.js     ──▶  work/queue/<slug>/        Caption, Hashtags, Seed, Status
                     ──▶  --release                manuelle Freigabe
```

**Fünf Dinge, die vorher nicht möglich waren:**

1. **Reproduzierbarkeit ohne Netz und ohne App.** Zwei Läufe mit demselben Seed liefern byteidentisches JSON und denselben Clip-Hash. Die Aufgaben kommen aus denselben `GEN{}`-Generatoren wie in der Lern-App — der Inhalt ist damit kein erfundener Clip-Themen-Text, sondern echtes App-Material.

2. **Der Clip wird gegen sich selbst geprüft.** `verify-clip.js` dekodiert Stichproben neu aus dem fertigen MP4 statt die PNGs zu lesen, und vergleicht sie mit dem erwarteten Bühnenzustand. Geprüft werden Hook, Reveal, Denkpause, Lösung, Endcard-Anfang und letzter Frame plus ein gleichmäßiges Raster — ein Aussetzer mitten im Reveal kann nicht unbemerkt bleiben.

3. **Geschlossene Hash-Kette.** `frameSetSha256` (Frames) = `sourceFrameSetSha256` (Clip-Manifest) = `frameSetSha256` (Laufbericht) = Wert in der Queue. Ein Clip aus einem fremden oder verkürzten Framesatz wird abgelehnt statt veröffentlicht. Die Queue prüft **alle drei Glieder** — sonst würde sie technische Daten zu einem Clip nennen, den es so nie gab.

4. **Vollständige Isolation.** Die Szene ist eine abgeschirmte Chrome-Instanz mit eigenem Profil; jede Anfrage außerhalb der Szene wird abgebrochen und protokolliert. Kein Login, kein Progress-Write, keine Nutzerdaten, keine externen Ressourcen (CSS und App-Skript werden inline injiziert).

5. **Freigabe ist ein eigener, nicht umgehbarer Schritt.** Neue Episoden landen als `bereit` mit `releasedAt: null`. `--release` ist die einzige Freigabe, und sie lehnt alles ab, was nicht vollständig ist — fehlendes MP4, ungeprüfter Lauf, gebrochene Kette. Es gibt im Code keinen Pfad, auf dem eine Episode sich selbst freigibt, und keinen Netzwerkpfad für ein automatisches Posten.

**Belegter Ist-Stand** (Seed `p7-3-5`, 3 Aufgaben, Stufe 2):

| | Wert |
|---|---|
| Clip | `clip.mp4`, 1080×1920, H.264 High, yuv420p, 30 fps, 480 Frames, 16,0 s |
| Dauer | ca. 7 s mit wiederverwendeten Frames, ca. 60 s ab Null (End-to-End-Test) |
| Geprüft | `overflowCount: 0`, `clippedTextCount: 0`, `blackFrameCount: 0` |
| Endcard | Logo full-bleed (1080×959, Füllgrad 1,0), 2,5 s Marken-Endcard |
| Tests | 48 grün (40 aus 7.3.1–7.3.5, 8 aus 7.3.6) |
| Generatoren | alle 47 aus `GEN{}` in `app-base.js` auswählbar, 3 Stufen |

**Bewusste Grenzen:** kein Audio (der Clip ist stumm), eine Hook-Vorlage (die übrigen drei folgen in 7.4), keine Veröffentlichung, lokale Platte statt Datenbank.

**Betrieb im Wochenrhythmus** — der folgende Ablauf ist mit 7.3 technisch vollständig umgesetzt; was noch fehlt, ist die Veröffentlichung (→ 7.4/7.5):

1. Node-Skript ruft **3–5 Generatoren** aus der Generator-Sammlung (`GEN{}` in `app-base.js`) auf → ✅ `select-exercises.js`
2. **Puppeteer** öffnet die App headless und triggert die vorhandene **Blueprint-Reveal-Animation** (bereits implementiert — von Natur aus „satisfying content“, ein bewährtes TikTok-Genre) → ✅ `render-frames.js`
3. **Frame-Recording** während der Animation → **ffmpeg** baut daraus ein **9:16-Vertical-Video** (15–25 Sek.) → ✅ `render-frames.js` + `assemble-video.js`
4. **Text-Overlay** aus Frage/Hook-Vorlage + Lösung — Hook zuerst, **2 Sek. Pause vor der Auflösung** (Retention-Technik) → ✅ `lib/timeline.js` (1 von 4 Hook-Formaten)
5. **Endcard** mit App-Name/Link automatisch angehängt → ✅
6. Video + Caption + Hashtag-Set in eine **Warteschlange** ablegen → ✅ `queue-episode.js`
7. **Kurze manuelle Freigabe** (30 Sek. anschauen, ok?) → dann auf **allen 3 Kanälen gleichzeitig** posten (gleiches Asset, kein Mehraufwand) → ⬜ manuell, 7.5

**Bedienoberfläche (P7.5):** `npm run review` bündelt alles in einer lokalen Werkstatt — Lauf starten, Protokoll, Zustand und Warteschlange. Die Startseite hat bewusst **keinen Videoplayer**: sie ist reine Steuerung, den Clip prüft man über die Warteschlange. Vier Seiten, auf allen eine Leiste zurück zur Werkstatt, damit kein Link eine Sackgasse ist; die ausführliche Prüfung mit Clip, Aufbau-Zeitleiste, Caption und Hashtags liegt unter `/p/<slug>`. Jedes Feld ist für Menschen beschriftet, nicht nach seinem internen Namen. Bewusst ohne Framework und ohne Build: das Werkzeug läuft neben dem Server aus einem Quellbaum, eine Abhängigkeit nur für eine Seite wäre Aufwand ohne Gegenwert.

**Caption folgt dem Bild (P7.5.2):** Ein Clip zeigt genau **eine** Aufgabe, die Auswahl aber drei bis fünf. `queue-episode.js` hat die Caption dennoch fest aus der ersten Aufgabe gebaut — wählte man in der Oberfläche „die 2.", stand im Video die Winkel-Aufgabe und in der Caption das Säulendiagramm. Der Slug landete zusätzlich immer unter `-i0`, sodass die Vorschau „1. von 3" anzeigte. Der Index kommt jetzt aus dem **Frame-Manifest**, also aus dem Beleg des Laufs: Caption, Tags und Slug folgen der Aufgabe, die tatsächlich gerendert wurde. Ohne diesen Beleg — oder bei einem Generator, der nicht zur Aufgabenliste passt — ist die Episode `unvollstaendig` und nicht freigabefähig; die Vorschau sagt dann „unbekannt", statt eine Nummer zu erfinden. Zwei Tests halten den Fehler fest: einer prüft, dass die Caption die Aufgabe aus dem Bild nennt und keine andere, einer prüft, dass ein fehlender Beleg nicht still geglaubt wird.

**Stack:** Puppeteer + ffmpeg, alles kostenlos — kein bezahlter Dienst nötig.

#### 🪝 Hook-Formate (für 10–14 nachweislich wirksam)

| Hook | Wirkmechanik | Status |
|---|---|---|
| „Kannst du das in 5 Sekunden lösen?“ | Countdown-Timer eingeblendet, Auflösung als Reveal | ✅ 7.4.2 |
| „Können Erwachsene das?“ (Mittelschul-Niveau) | Doppelter Effekt: Kids teilen's stolz bei Erfolg; Erwachsene, die scheitern, ist von Natur aus shareable | ✅ 7.4.3 |
| „Schaffst du 7 Tage in Folge?“ | Streak-Leiste mit 7 sichtbaren Tagespunkten, synthetischer Beispielwert | ✅ 7.4.3 |
| Vorher/Nachher | „So erklärt's die Schule“ (Hinweis als Textkarte, Figur ausgeblendet) vs. „So macht's die App“ (Blueprint-Zeichnung) | ✅ 7.4.3 |

**Drei ehrliche Abweichungen von der ursprünglichen Formulierung:**

1. **5 statt 10 Sekunden.** Der Countdown zählt sichtbar von 5 herunter. Ein Hook, der „10 Sekunden“ verspricht, während im Bild 5 heruntergezählt wird, ist der meistgelesene Fehler in solchen Clips. Zehn Sekunden *stille* Pause wären zwar im Zeitfenster, aber ein echter Retention-Killer — deshalb 5 s Pause und 19 s Gesamtclip.
2. **Streak ohne Screen-Recording.** Die Leiste mit 7 Tagespunkten ist umgesetzt, ein echtes Screen-Recording der App-Gamification **nicht** — die Pipeline rendert eine 916×1080-Bühne, nicht die App-Oberfläche. Der Wert ist ein synthetischer Beispielwert ohne Nutzerbezug (7.4.3).
3. **Erwachsenen-Challenge rein als Text.** Der Doppel-Effekt entsteht beim Teilen, nicht im Clip. Im Bild steht die Herausforderung mit Mittelschul-Niveau; mehr gibt der Clip her nicht her, und eine erfundene „Erwachsene scheitert“-Szene wäre Behauptung statt Beleg.

**Stand der Nacharbeit (7.4.3 war als ✅ markiert, war es aber nicht):** Die Tabelle behauptete bis jetzt ⬜ für drei Hooks, obwohl `lib/timeline.js` alle fünf Vorlagen seit 7.4.1 enthielt. Bei der Prüfung im gerenderten Clip zeigte sich: **Vorher/Nachher war sichtbar nicht umgesetzt.** Das Segment `vorher` gab `revealProgress = 1`, die Figur war dort also bereits fertig gezeichnet — Schulweg, Denkpause und Auflösung waren pixelgleich (gleiche MD5). Zusätzlich wurde `vorher` als unbekanntes Segment behandelt und deshalb durchgehend mit 1 versehen. Nachgeholt: Figur wird im Schulweg ausgeblendet und nicht gezeichnet, es erscheinen zwei beschriftete Karten mit echtem Text.

**Der Fehler, den die Nacharbeit selbst einbrachte** — und warum er auffiel: `nachherVisible` war an kein Feld gekoppelt und dadurch auch im Standardlauf wahr. Ab dem ersten Reveal-Frame stand eine leere goldene Karte im Bild; **253 von 480 Frames** des Standardlaufs hatten sich unbemerkt verändert. Kein Zustandstest sah das — erst der Pixelvergleich gegen den Altstand (`frameSetSha256 1dd3f1a0…` → wiederhergestellt). Abgesichert durch `testCardsBoundToTheirHook`.

**Vorsicht bei künftigen Vorlagenfeldern:** `buildDocument()` in `lib/isolated-scene.js` lässt nur eine Whitelist an Feldern zur Bühne durch. Ein fehlender Eintrag dort bedeutet: das Feld existiert in der Zeitachse, die Anzeige bleibt aber **still leer, ohne Fehlermeldung**. Genau das ist beim ersten Bauen der Karten passiert.

#### ⚠️ Zwei operative Punkte (unabhängig von der Strategie-Entscheidung)

1. **Kommentare moderieren oder deaktivieren** — bei Videos mit erkennbar Kinder-Zielgruppe ziehen offene Kommentarspalten unerwünschte Erwachsene an. Reine Schutzmaßnahme.
2. **Bezahlte Werbung (nicht organischer Content)** darf sich in EU/AT rechtlich nicht gezielt an unter 13-Jährige richten — betrifft nur ein späteres Ads-Budget, nicht den organischen Content-Plan.

**Stand 7.6 — beide Punkte sind entschieden, nicht nur geplant:**

- **Kommentare:** je Plattform einzeln bewertet. Bei **YouTube deaktiviert**, weil
  die Zielgruppe erkennbar 10–14 ist und offene Kommentarspalten dort das
  größte Risiko sind. TikTok und Instagram wurden entsprechend eingestellt.
  Damit ist 7.6 **kein Blocker für weitere Posts** — die Roadmap hatte es in
  Zeile „vor dem ersten Post" gefordert, und diese Reihenfolge ist eingehalten.
- **Bezahlte Werbung:** nicht vorgesehen. Solange es kein Ads-Budget gibt, ist
  die EU/AT-Grenze für gezieltes Targeting unter 13 faktisch eingehalten.

**Konsequenz:** Punkt 5 der „bewussten Reihenfolge" ist damit erledigt. 7.4.6
konnte wie geplant laufen.

#### 📅 Realistischer Aufwand

- **Pipeline-MVP (Schritte 1–7):** erledigt ✅
- **Laufend:** ~1 Std./Woche (Freigabe + Posten auf 3 Kanälen)
- **Erste messbare Reichweite:** realistisch 1–3 Wochen nach dem ersten Post (TikTok schnell, YouTube Shorts träger)

#### 🧩 7.4 — Plan: Hook-Bibliothek und die ersten Veröffentlichungen

**Ausgangslage:** 7.3 liefert fertige, freigegebene Clips — aber nur in **einer** Form. `lib/timeline.js` hat die fünf Segmente fest verdrahtet (`hook` 3 s, `reveal` 4 s, `pause` 2 s, `solution` 4 s, `endcard` 3 s), es gibt genau **eine** Hook-Vorlage, und im Repo existiert **kein** Publishing-Code und **keine** Action dafür (nur `weekly-summary.yml`). Die Kanäle aus 7.2 sind live, die Queue ist mit einer Episode gefüllt.

**Strategische Überlegung vorweg:** Die Hook-Bibliothek und das automatische Posten sind zwei sehr verschiedene Risiken. Der erste Clip ist ein Reputationsrisiko auf einem Kinder-Kanal; ein falscher Post ist sichtbar und nicht zurücknehmbar. Deshalb ist die Reihenfolge bewusst so gewählt, und **7.4 ist in zwei Teile geteilt, die getrennt abgenommen werden**.

##### Teil A — Hook-Bibliothek (7.4.1–7.4.3) · ohne Netz, ohne Risiko

| Paket | Inhalt | Abnahme | Aufwand |
|---|---|---|---|
| **7.4.1** | `lib/timeline.js` von festen Segmenten auf **Vorlagen** umstellen: je Vorlage Segmentfolge, Dauern, Reveal-Art und Countdown-Text. Auswahl per `--hook <name>`, Standard bleibt der bestehende Ablauf. | Jede Vorlage ergibt einen gültigen 15–25-s-Clip; der bestehende Lauf bleibt byteidentisch; unbekannter Hook-Name ist ein klarer Fehler, kein stiller Fallback. | ✅ `lib/timeline.js` + 6 Tests |
| **7.4.2** | **Countdown** („Kannst du das in 5 Sekunden lösen?“): sichtbarer Timer über der Denkpause, exakt auf die Pause abgestimmt, deterministisch pro Frame. | Timer läuft synchron zur Denkpause, endet bei 1 statt 0; nie `0` oder abgeschnitten im Bild; **die Zahl im Hook-Text ist die Zahl, die sichtbar heruntergezählt wird.** | ✅ `stage-916.html`, als Test festgeschrieben |
| **7.4.3** | **Die drei weiteren Hooks** als Vorlagen: Erwachsenen-Challenge, Streak-Flex, Vorher/Nachher. Nur was ohne echte Nutzerdaten geht — der Streak-Hook nutzt synthetische Beispielwerte, keine echten Konten. | Pro Hook ein geprüfter Clip; `verify-clip.js` besteht für alle vier; jede Vorlage einzeln anwählbar. | ✅ nachträglich eingeholt, 9 Tests |

**Nachtrag zu 7.4.3 — der Eintrag war zu früh abgehakt.** Die fünf Vorlagen existierten zwar in `lib/timeline.js`, aber **nicht im fertigen Bild**: Vorher/Nachher war ein Segment ohne Wirkung (Schulweg, Denkpause und Auflösung pixelgleich), beim Streak-Hook existierte keine Zahl und kein 🔥, und die Erwachsenen-Challenge war nur eine Textzeile. Erst `verify-clip.js` hätte das zeigen können — die Abnahme „ein geprüfter Clip pro Hook“ war nie gelaufen.

**Jetzt nachgemessen, nicht behauptet.** Alle vier Vorlagen durch die volle Kette (`run-pipeline.js` → Frames → MP4 → `verify-clip.js`), jeweils mit demselben Seed:

| Vorlage | Laufzeit | `verify-clip.js` | Urteil |
|---|---|---|---|
| `countdown` | 19 s | `CLIP_CHECK_OK` (22 Frames) | ✅ |
| `erwachsenen` | 16 s | `CLIP_CHECK_OK` (19 Frames) | ✅ |
| `streak` | 16 s | `CLIP_CHECK_OK` (19 Frames) | ✅ |
| `vorher-nachher` | 18 s | `CLIP_CHECK_OK` (21 Frames) | ✅ |
| `frage` (Standard) | 16 s | `CLIP_CHECK_OK` (19 Frames) | ✅ |

Der entscheidende Beleg für den Vorher/Nachher-Fix steht in `verify-clip.js`:

```
frame  90 vorher   reveal=0.00 solution=0.00 endcard=nein   OK
frame 120 vorher   reveal=0.00 solution=0.00 endcard=nein   OK
frame 149 vorher   reveal=0.00 solution=0.00 endcard=nein   OK
```

`reveal=0.00` im Schulweg heißt: dort ist nichts aufgedeckt. Vor der Nacharbeit stand dort `reveal=1.00` — die fertige Lösung, zwei Sekunden vor der Denkpause.

**Ergebnis Teil A:** Fünf Vorlagen, alle zwischen 15 und 25 s, alle mit `PIPELINE_OK` und `CLIP_CHECK_OK` belegt. `frage` ist der bisherige Ablauf und **bytegleich** — ohne `--hook` ändert sich nichts (belegt über `frameSetSha256`, nicht über Augenschein).

##### ➕ Zusätzlich: Freigabe per Link (`review-server.js`)

Fertige Clips liegen nach `npm run queue` in `work/queue/`. `npm run review` startet einen kleinen Server, der sie im Browser zeigt — mit Link für den Rechner **und für das Handy im selben WLAN** — und die Freigabe per Klick entgegennimmt.

- **Nichts wird veröffentlicht.** Der Server kennt keinen Netzwerkpfad und ruft keine Plattform auf; er liest und schreibt nur in `work/queue/`. Das Posten bleibt manuell.
- **Der Token steht im Link.** Ohne ihn zeigt der Server nichts und nimmt nichts an. Es gibt keine Anmeldung, weil es keine Nutzer gibt — deshalb ausschließlich für das eigene Netz gedacht.
- **Die Freigabe nutzt dieselbe Funktion wie `--release`.** Der Server kann nichts freigeben, was das Skript nicht auch freigeben würde; eine unvollständige Episode zeigt gar keinen Knopf und lehnt auch einen erzwungenen POST ab.
- Beenden mit Strg-C. Kein Dienst, kein Watchdog.

| Paket | Inhalt | Abnahme | Status |
|---|---|---|---|
| **7.4.F** | **Freigabelink ohne Netz:** lokaler Review-Server mit Token-Schutz, Videoplayback, Caption/Hashtags und Freigabeklick. | Ohne Token kein Zugriff; Fremdpfade abgewiesen; eine unvollständige Episode lässt sich weder per Knopf noch per erzwungenem POST freigeben. | ✅ `review-server.js` + 6 Tests |

**Warum die Reihenfolge:** Der Countdown zuerst, weil er als einziger einen **neuen sichtbaren Mechanismus** einführt und damit das größte Rendering-Risiko trägt. Die drei übrigen sind Umbenennungen und Umbauten bestehender Segmente.

**Wichtig:** Diese Phase ändert **nichts** am Publish-Verhalten. Ergebnis sind vier tested, lokal freigegebene Clips — noch immer ohne Upload.

##### Teil B — Veröffentlichung (7.4.4–7.4.6) · hier entstehen echte Posts

| Paket | Inhalt | Abnahme | Aufwand |
|---|---|---|---|
| **7.4.4** | **Plattform-Rechte klären, bevor Code entsteht.** TikTok Content-Posting-API, YouTube Data API v3, Instagram Graph API: freigeschalteter Content-Posting-Zugang, App-Review, Quoten und Altersrichtlinien. | Für alle drei Kanäle ist schriftlich geklärt: Zugang vorhanden? Review bestanden? Rate-Limits? | ✅ Kanäle live, Zugänge geprüft |
| **7.4.5** | **`publish-episode.js`**: nimmt **ausschließlich** freigegebene Episoden (`status: "freigegeben"`), prüft vor dem Absenden Hash-Kette und Status erneut, postet, schreibt die Plattform-IDs zurück ins Manifest (`publishedAt`, `posts[]`). | Eine nicht freigegebene Episode wird abgelehnt; ein fehlgeschlagener Post lässt das Manifest auf `freigegeben` mit Fehlervermerk, ohne Doppel-Post beim Wiederholen; Zugangsdaten kommen **ausschließlich** aus der Umgebung, nie aus dem Repo. | ⏭ bewusst offen |
| **7.4.6** | **Die ersten 3 echten Posts** — bewusst wenige, mit Beobachtung dazwischen. | 3 Clips auf 3 Kanälen, je 24 h Reichweite/Retention notiert; bei auffälligem Feedback sofort Stopp. | ✅ erste Videos veröffentlicht |

#### 📺 Stand der Veröffentlichung (7.4.4–7.4.6)

**Kanäle — öffentliche URLs für Besucher, Studio-Links intern:**

| Kanal | Öffentliche URL | Übersicht / Studio (intern) |
|---|---|---|
| **YouTube** (Shorts) | [youtube.com/channel/UCLYEbAqgnCGcWASkaDOnXjw](https://www.youtube.com/channel/UCLYEbAqgnCGcWASkaDOnXjw) | [Studio – Inhalte](https://studio.youtube.com/channel/UCLYEbAqgnCGcWASkaDOnXjw/content?d=ud) |
| **TikTok** | [tiktok.com/@mathefit.andybrandy.at](https://www.tiktok.com/@mathefit.andybrandy.at) | TikTok-Profil |
| **Instagram** | [instagram.com/mathemit.andybrandy.at](https://www.instagram.com/mathemit.andybrandy.at/) | Instagram-Profil |

**Gepostet wird weiterhin manuell.** Der Studio-Link ist eine Übersicht, kein
Publish-Endpunkt — und genau so ist es gewollt: der Freigabeschritt bleibt
zwingend (siehe Punkt 2 unter „Bewusste Reihenfolge").

**Warum 7.4.5 (`publish-episode.js`) bewusst offen bleibt:** Die Roadmap hat dafür
eine eigene Abbruchregel — steht ein API-Zugang nicht, wird **nicht ersetzt**,
sondern läuft 7.5 manuell weiter. Da die Clips ohnehin manuell gepostet werden,
ist der Automationsschritt Komfort, nicht Engpass. Ihn jetzt zu bauen hieße,
Code für Zugänge zu schreiben, deren Freischaltung offen ist. **Wird er
nachgerüstet, dann mit `--dry-run` von Anfang an und ohne Auto-Freigabepfad.**

**Abbruchregel für 7.4.4 (bleibt gültig):** Steht einer der drei Zugänge bis
dahin nicht, wird **nicht** ersetzt — dann läuft 7.5 manuell weiter, wie es heute
schon geplant ist. Automatisierung ist ein Komfort, kein Ersatz für den manuellen
Schritt.

##### Bewusste Reihenfolge und Grenzen

1. **Erst Inhalte, dann Uploads.** Teil A ist vollständig risikofrei und liefert unabhängig Wert — auch wenn Teil B nie stattfindet.
2. **Freigabe bleibt auch mit Publishing-Code zwingend.** `publish-episode.js` bekommt keinen Auto-Freigabe-Pfad. Das ist der wichtigste Sicherheitsgurt: Ein Fehler in der Automatik darf nicht dazu führen, dass ungeprüfter Content live geht.
3. **`--dry-run` von Anfang an.** Jeder Publish-Aufruf muss erst beschaubar sein, was passieren würde. Kostet eine Stunde, erspart den ersten Fehler.
4. **Rückweg ist Pflicht.** Plattform-IDs werden ins Manifest geschrieben, damit ein gelöschter Post nachvollziehbar bleibt und nicht versehentlich neu erzeugt wird.
5. **7.6 (Schutz & Recht) ist keine spätere Kosmetik.** Kommentare bei Kinder-Content gehören **vor** den ersten Post abgesichert, nicht danach — das gehört inhaltlich vor 7.4.6 und ist eine Entscheidung, keine Technik.

**Was 7.4 bewusst nicht macht:** keine Auto-Playlist-Erstellung, keine Kommentar-Interaktion, kein A/B-Test von Captions, keine Analytics-Anbindung. Das sind 7.5-Themen und brauchen echte Reichweitendaten, nicht nur mehr Code.

---

### P6 — Eulenhain (endlose Stufen + Eulensammlung)

| # | Schritt | Status |
|---|---------|--------|
| 6.1 | Endlose Stufen: Formel `50·(n−1)·n` (Stufe 2=100, 3=300, 10=4500 …) + Rangtitel alle 5 Stufen, danach endlos mit römischer Zählung („Mathe-Legende II") | ✅ |
| 6.2 | Eulen-Engine: parametrische Eule in Logo-Geometrie, 12 kuratierte Farbwelten → nahtlose Farbton-Rotation (unendlich), 8 Signature-Animationen | ✅ |
| 6.3 | 🦉 **Eulenhain als eigene Seite**: großes SVG-Baum-Panel (Himmel mit Sonne & treibenden Wolken, Schmetterlinge, Hügel, Wiese, Blumen) — ein echter Baum mit Stamm, Wurzeln & flauschiger Krone, der **mit jeder Stufe wächst** (neue Ast-Ebene pro 5 Eulen, breiter werdende Krone); Antippen zeigt Signatur-Animation + Namen, nächste Eule wartet als Silhouette auf dem Tag-Ast direkt unter der Krone | ✅ |
| 6.4 | Persistenz: lokal + `progress.owls` (JSON) geräteübergreifend; Migration: bestehende Nutzer erhalten alle Eulen bis zur aktuellen Stufe automatisch | ✅ |
| 6.5 | Aufstiegs-Feier: Konfetti + Banner mit neuem Eulennamen + Logo-Eule flattert; „Bewegung reduzieren" wird respektiert | ✅ |
| 6.6 | **Feinschliff Astgeometrie**: Astreihen sitzen über der Wiese, Äste verjüngt + längenabhängig, Eulen auf der Astkurve; **Kronenbreite folgt der längsten Astreihe** (Kronenrand an der Astspitze, dichte Krone) | ✅ |

> **Live-Migration P4.2:** `ALTER TABLE progress ADD COLUMN goals JSON NULL AFTER owls;` in phpMyAdmin ausführen + aktualisierte `backend/progress.php` auf den mapi-Server hochladen.

---

### P8 — Auffindbarkeit & SEO *(größter ungenutzter Wachstumshebel · ergänzt P7)*

Die App ist eine Single-Page ohne indexierbaren Inhalts-Layer — Eltern/Lehrer
googeln aber „Mathe üben Mittelschule / Lehrplan 2023". Komplementär zu P7
(Shorts wecken Bekanntheit, SEO fängt die Suchnachfrage auf).

| # | Aufgabe | Status |
|---|---------|--------|
| 8.1 | `robots.txt` + `sitemap.xml` | ✅ |
| 8.2 | JSON-LD `WebApplication` + Meta/Open-Graph in `index.html` | ✅ |
| 8.3 | Indexierbarer „Abdeckung"-Abschnitt (Lehrplan H1–I3) | ✅ |
| 8.4 | FAQ-Block (`FAQPage`) + „Für Lehrkräfte" | ✅ |
| 8.5 | Google Search Console anmelden & Sitemap einreichen | ✅ |
| 8.6 | `llms.txt` (v2) für KI-Assistenten + `rel="describedby"` | ✅ |

### P9 — Wachstum: Lehrkräfte & Reichweite

| # | Aufgabe | Status |
|---|---------|--------|
| 9.1 | Minimales Lehrer-Dashboard zum Klassen-Code (Fortschritt aggregiert) | ⬜ |
| 9.2 | Newsletter-/E-Mail-Einstieg (Resend bereits angebunden) | ⬜ |
| 9.3 | Datensparsame Reichweiten-Messung (self-host, kein Google) | ⬜ |

### P10 — Recht & Datenschutz

| # | Aufgabe | Status |
|---|---------|--------|
| 10.1 | Google Fonts self-hosten (schließt US-Transfer-Risiko) | ⬜ |
| 10.2 | Datenschutzerklärung: Google Fonts + Resend als Verarbeiter ergänzen | ⬜ |

### P11 — Betriebs-Robustheit

| # | Aufgabe | Status |
|---|---------|--------|
| 11.1 | Weitere Endpunkte (`feedback`, `klassen`, …) DB-drift-tolerant wie `progress.php` | ⬜ |

---

## 🎯 P1 — Konkrete nächste Schritte

### Schritt 1: Lineare Gleichungen (H2.I1) ✅
- [x] `genGleichungEinfach()` — ax + b = c, x ∈ ℕ
- [x] SVG: Waagen-Visualisierung
- [x] Tipp 1: „Was möchtest du allein auf einer Seite haben?"
- [x] Test: 200 Läufe, x ganzzahlig positiv

### Schritt 2: Tabellen lesen (I3.M1) ✅
- [x] `genTabelleLesen()` — einfache Zuordnungstabelle
- [x] SVG: gerenderte HTML-Tabelle als SVG

### Schritt 3: Säulendiagramme (I3.M1) ✅
- [x] `genDiagrammBalken()` — Balken auswerten

### Schritt 4–8: Restliche Lücken ✅
- [x] Gemischte Zahlen, Bruch↔Dezimal, Zinsen, Proportionalität, Mehrstufig

---

## 📝 Konventionen

- Jeder neue Generator: `withCurriculum(key, fn)` + `CURRICULUM_MAP`-Eintrag + `GRADE_TAGS`
- Tests: Node-Harness (`/tmp/mathemit-*.js`) — min. 200 Läufe, Antwort prüfen
- Commits: `P1.x: <Thema> — <kurz>` + Version bump via pre-commit hook
- SVG: dunkelgrau (#444444) für Beschriftungen, Comic-Stil
- Konsistenzprüfung: `node scripts/konsistenz-check.js` (committeter Harness: alle 47 Generatoren × 3 Stufen × 25 Läufe gegen Pflichtfelder, Begriffs-Verbote (W38: „Radi" → „Rad"), Diagramm-Label-Abgleich und Einzelfrage-Regel (W39: genau **eine** Teilfrage je Antwortfeld; der Harness enthält dafür eine Positiv-/Negativkontrolle, damit die Regel nicht stillschweigend wirkungslos wird)

---

## ✅ Definition of Done

- [ ] Generator erzeugt valides Exercise-Objekt
- [ ] SVG ist wohlgeformt (`<svg` … `</svg>`)
- [ ] Antwort stimmt mathematisch (200 Läufe geprüft)
- [ ] Curriculum-Code + Kompetenz-Text vorhanden
- [ ] In GEN-Registry + MODES-Pool eingetragen
- [ ] Version gebumpt + gepusht

### UX-Vollständigkeit jedes Generators (Chips & Wissensgarten)

Jeder neue Generator muss **an allen fünf Flächen** auftauchen, sonst ist er für
Nutzer unsichtbar oder fällt aus der Gesamtlogik:

- [ ] `GEN` (Rechenlogik)
- [ ] `CURRICULUM_MAP` (Lehrplan-Zuordnung)
- [ ] `GRADE_TAGS` (Stufen-Zuordnung)
- [ ] `MODES` → echter Topic-Chip (`group !== null`, nicht nur „alles")
- [ ] `GARTEN_BEREICHE` → Wissensgarten-Baum

**Automatisch erzwungen:** `.githooks/pre-commit` ruft
`scripts/check-generator-surfaces.js` auf und bricht jeden Commit ab, der einen
Generator unvollständig einbindet (Positiv- und Negativfall getestet).

---

## 📚 Feature-Dokumentation (für alle Nutzer)

- 15 Themen-Modi als wischantipbare Leiste; die aktive Auswahl rutscht automatisch in die Mitte, dezente Trennpunkte markieren die Lehrplan-Gruppen (Geometrie · H3, Zahlen & Operationen · H1, Sachrechnen · I1, Größen & Variablen · H2, Daten & Statistik · H4).
- Schulstufen-Filter (1./2. und 3./4. Klasse) und drei Schwierigkeitsstufen (🌱 Einstieg, 🎯 Training, 🚀 Anforderung) sind kombinierbar.
- Nach 2 Fehlversuchen in Folge erscheint ein Button zum direkten Wechsel der nächsten niedrigeren Stufe (Training → 🌱 Einstieg, Anforderung → 🎯 Training); nach 3 richtigen in Folge zum Aufstieg (Einstieg → 🎯 Training, Training → 🚀 Anforderung).

### Tipps & Hilfe
- Der 💡-Button deckt Tipps schrittweise auf: Tipp 1 deutet an, Tipp 2 nennt Formel oder Ansatz.
- Bei falscher Antwort erscheint ein 🧭 Merke-Hinweis zur passenden Rechenstrategie.

### Wiederholungstraining (🔁)
- Jede falsch beantwortete Aufgabe wird automatisch im Wiederholungstraining gespeichert – genau diese Aufgabe inklusive der Original-Grafik (nicht nur der Aufgabentyp).
- Der 🔁-Chip zeigt die Anzahl der gespeicherten Wiederholungen; ein Antippen übt genau diese Aufgaben der Reihe nach.
- Eine korrekt gelöste Wiederholung verlässt die Liste; ist die Liste leer, erscheint die Erfolgsmeldung und die Auswahl kehrt zu den normalen Aufgaben zurück.
- Bleibt eine Wiederholung falsch, bleibt sie in der Liste und kommt erneut.
- Funktioniert als Gast (lokal im Browser) und angemeldet (geräteübergreifend synchronisiert).

### Punkte, Serie & Flamme
- 10 Punkte pro richtiger Aufgabe plus Serien-Bonus (bis 10 extra).
- Die 🔥-Flamme flackert sanft, solange die Serie läuft; Antippen pausiert die Animation, erneutes Antippen setzt sie fort (auch mit Enter oder Leertaste). Die Systemeinstellung „Bewegung reduzieren" wird respektiert.
- Das Eulen-Logo im Header blinkt gelegentlich, die Pupillen folgen dem Cursor und die Flügel wedeln bei jeder richtigen Aufgabe.

### Wöchentliche Ziele (🎯) — P4.2
- Direkt unter dem Fortschrittsbalken steht in einer Zeile **"Dein Wochenziel:"** mit 3 Mini-Balken (Klick öffnet Details mit Motivationsspruch + Bonus-Hinweis): 🎯 Sammle 50 Punkte · 📚 Löse 20 Aufgaben (**nur richtige Lösungen zählen**) · 🔁 Schaffe deine Wiederholungen (**dynamisch**: jeder Fehler dieser Woche erhöht das Ziel wie beim 🔁-Chip, jede gemeisterte Wiederholung füllt es — bei einem neuen Fehler ist es wieder offen).
- Die Woche startet am **Montag**; alte Zähler werden dann automatisch zurückgesetzt.
- Ein geschafftes Ziel wird grün mit ✅ markiert. Das Wiederholungsziel kann sich innerhalb der Woche wieder öffnen, wenn neue Fehler dazukommen; sind diese Woche noch keine Fehler passiert, gilt es als erreicht (🎉 keine offenen Wiederholungen).
- **Alle 3 Ziele geschafft = +30 Bonus-Punkte** (einmal pro Woche) — das beschleunigt Stufen und Eulenhain zusätzlich.
- Beim Schaffen eines Ziels gibt es Konfetti und einen Banner unter der Aufgabe.
- Die Ziele werden dauerhaft gespeichert (als Gast im Browser, angemeldet geräteübergreifend).

### Eulenhain (🦉) — Stufen & Eulensammlung
- Jede gelöste Aufgabe bringt Punkte; die **Stufen sind endlos** (Stufe 2 bei 100 Punkten, Stufe 3 bei 300, danach steigend). Jede Stufe hat einen Rangtitel (Geometrie-Lehrling, Formen-Geselle …), der alle 5 Stufen wechselt und später durchzählt („Mathe-Legende II").
- **Jede Stufe schaltet eine eigene Eule frei** – ab Stufe 1 gehört dir die erste Eule. Jede Eule hat eine eigene Farbwelt (Rubin, Smaragd, Saphir, Bernstein …) und eine eigene kleine Animation (Flattern, Blinzeln, Wippen, Kopfkippen, Hüpfer, Schlafenszeit, Drehung, Federsträuben).
- Über die 🦉-Pille neben „Rang" öffnet sich der **Eulenhain als eigene Seite**: ein großer Baum unter Himmel und Sonne — Stamm, Wurzeln, flauschige Krone und geschwungene Äste. Die gesammelten Eulen sitzen je zu fünft auf einem Ast (die älteste unten, die neueste ganz oben); **der Baum wächst mit jeder neuen Stufe** ein Ast-Stück weiter und die Krone wird breiter.
- **Tippe eine Eule an** und sie zeigt ihre kleine Show (Flattern, Blinzeln, Wippen …) — ihr Name und ihre Stufe erscheinen darunter. Die neueste Eule wippt sanft vor sich hin.
- Die **nächste Eule** wartet als Silhouette am letzten Ast; darunter steht, wie viele Punkte noch fehlen.
- Beim Stufen-Aufstieg regnet kurz Konfetti und ein Banner verkündet die neue Eule (mit „Bewegung reduzieren" bleibt es ruhig).
- Der Eulenhain wird dauerhaft gespeichert – als Gast im Browser, angemeldet geräteübergreifend.

### Wissensgarten (🌳) — P4.1
- Über die 🌳-Pille in der Statistikzeile öffnet sich der **Wissensgarten als eigene Seite** (wie der Eulenhain): eine Wiese mit Sonne, Wolken und **6 Kompetenz-Bäumen** — je Lehrplanbereich: 🌰 Bruch-Baum, 🪙 Prozent-Baum, 📐 Winkel-Baum, 📏 Flächen-Baum, 🧺 Alltags-Baum, 🔗 Daten-Baum.
- Jeder Baum steht auf einem **dreizeiligen Holzschild** (Name / Thema / Status, z. B. „Sachaufgaben" oder „Gleichungen"). Die Höhe von 34 auf 72px ermöglichte eine zweite Zeile und zugleich mehr Luft zwischen den Brettern (12px statt 4px) — vorher standen sie aneinandergereiht. Schrift 17/15/16px statt 12/13px, weil die 1000er-Bühne auf dem Handy auf ~0.39 skaliert und kleine Angaben sonst unter 5px realer Größe landen.
- Jeder **Apfel** in der Krone ist eine genaue Mathe-Kompetenz (alle 47 Übungstypen). Einheitlich Äpfel statt einer Mischung — auf Abstand war die Birne nicht als Obst erkennbar, sondern nur als weiterer Kreis.
- Die **Farbe ist die Reife**, wie bei einer echten Frucht: 🟢 hellgrün = noch nie geübt · 🟡 gelb = im Wuchs (Stufe 1–2) · 🟠 orange = reif (Stufe 3–4) · 🔴 rot = gemeistert (Stufe 5). Die Rampe läuft bewusst von hellgrün nach rot, damit „dunkler = besser" einen Blick genügt.
- Eine **Wiederholung fällig** ist kein eigener Farbton (Rot gehört der Reife), sondern ein **weicher Hellgrün-Lichtschein** hinter dem Apfel. Er färbt ihn nicht ein und wächst mit seinem Radius, statt eine feste Größe zu haben. Die ⏰-Uhr als Zeichen am Baum ist entfallen.
- Der **Stamm wächst** mit der Beherrschung des Baums — je mehr du sicher kannst, desto höher ragt er. Über jedem **goldenen Baum** zieht ein Tier ein (Eichhörnchen, Papagei, Biene …).
- **Tippe eine Frucht an**: du siehst den genauen Kompetenztext, den Lehrplan-Code und deine Leiter-Stufe. Ein Klick auf **„🌿 Jetzt üben"** startet sofort den gezielten Fokus-Modus — oben in der Leiste erscheint der 🎯-Fokus-Chip (Antippen beendet ihn wieder).
- Wird ein Baum komplett golden, gibt es Konfetti und einen Banner — Bewegung reduzieren wird respektiert. Der Wissensgarten wird **automatisch** aus deinem Wiederholungs-Fortschritt berechnet (keine Extra-Speicherung, geräteübergreifend über dein Konto).

### Feedback
- Der 💬-Button (erscheint nach 10 Sekunden) sendet Aufgabe und Hinweis als öffentliches GitHub-Issue; bitte keine persönlichen Daten angeben.
- Jeden Freitag um 12:00 Uhr erstellt eine KI automatisch eine Wochenauswertung mit Entwicklungsvorschlägen.
- Die Benachrichtigungs-Mail wird über Resend versendet (Repository-Secrets RESEND_API_KEY und MAIL_TO); zusätzlich empfohlen: das Repository mit „All Activity" beobachten und E-Mail-Benachrichtigungen in den GitHub-Einstellungen aktivieren.

### Konto, Datenschutz & Rechtliches
- Registrierung mit Nickname und 4-stelliger PIN; der Fortschritt wird geräteübergreifend gespeichert.
- Datenschutz, Impressum und Nutzungsbedingungen öffnen als Pop-up im Footer.
- Die Registrierung erfordert die Bestätigung „14 Jahre oder älter" bzw. die Erlaubnis eines Erziehungsberechtigten (Art. 8 DSGVO).
