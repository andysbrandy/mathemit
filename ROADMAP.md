# 🗺️ Mathemit — Roadmap zur besten Mathe-Lern-App in Österreich

> Stand: laufende Version siehe App-Footer bzw. VERSION-Datei | Ziel: Vollständige Lehrplan-Abdeckung (AHS/MS 2023) mit pädagogischem Support + Feedback-Loop

---

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
- **Wissenswald (Kompetenz-Bäume)** — P4.1: 6 Bäume je Lehrplanbereich, Blätter färben sich nach Beherrschung (Spaced-Leiter), goldene Bäume ziehen Tiere an; Klick auf ein Blatt startet gezieltes Training.
- **Streaks, Basis-Badges, Auth-System**
- **Comic-SVG-Engine** (gerundete Silhouetten, dynamische Skizzen)
- **Geometrisches Eulen-Logo**: blinkt, die Pupillen folgen dem Cursor, die Flügel wedeln bei richtigen Aufgaben („Bewegung reduzieren" wird respektiert)
- **9 Alltag-Textaufgaben** mit Österreich-Bezug
- **Qualitätssicherung**: Pre-Commit-Check gegen nicht deklarierte Variablen (`scripts/check-strict-vars.py`) — verhindert „ReferenceError: Can't find variable"-Abstürze im `use strict`-Code der App

---

## 🏔️ Die 5 Prioritäten

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
| 4.1 | **Wissenswald** (Kompetenz-Bäume je Lehrplanbereich, eigene Seite wie der Eulenhain) | ✅ 6 Bäume (Brüche, Prozente, Formen, Messen, Alltag, Struktur) — 47 Generatoren als Blätter, Färbung aus der Spaced-Leiter (grün/gelb/rot/gold), Baum wächst mit Beherrschung, Tiere ziehen in goldene Bäume, Klick auf ein Blatt = gezielter Fokus-Übungsmodus; keine neuen DB-Felder (lebt von `progress.spaced`) |
| 4.2 | Wöchentliche Ziele | ✅ 3 Ziele (🎯 50 Punkte · 📚 20 Aufgaben · 🔁 5 Wiederholungen), ISO-Wochenstart montags, Fortschrittsbalken, +30 Bonus-Punkte bei allen 3 Zielen; gespeichert lokal + DB (`progress.goals`) |
| 4.3 | Wiederholungstraining (falsch gelöste Aufgaben exakt wiederholen) | ✅ (Instanz-Speicherung inkl. Original-Grafik, lokal + DB, 🔁-Chip, Erfolgsmeldung) |

### P5 — Österreich-Bezug & Polish

| # | Schritt | Status |
|---|---------|--------|
| 5.1 | Mehr Regionen (15+ Alltag-Generatoren) | ❌ |
| 5.2 | PWA / Offline | ❌ |

**Was steckt hinter 5.2 (PWA / Offline)?** — Noch nicht umgesetzt (kein Manifest, kein Service Worker, keine PWA-Metadaten in `index.html`).

1. **Installierbarkeit (PWA):** `manifest.webmanifest` (Name, Icons, Theme-Farbe, `display: standalone`) + Meta-Tags in `index.html` (`<link rel="manifest">`, `theme-color`, Apple-Tags) → App per „Zum Home-Bildschirm" wie eine native App installieren und ohne Browser-Chrome öffnen.
2. **Offline-Start:** Service Worker (`sw.js`) cached beim ersten Besuch die Kern-Dateien (`index.html`, `app-base.js`, `app-active.js`, beide CSS, `logo.svg`) → App startet auch ohne Internet (Stale-While-Revalidate, `CACHE_VERSION` an die `VERSION`-Datei koppeln, damit `?v=`-Deploys frisch werden).
3. **Herausforderung — Fortschritt lebt in der DB:** Übungen sollen offline weiterlaufen; Punkte/Spaced-Fortschritt landen dann lokal (`localStorage`) und werden als **Offline-Write-Queue** bei nächster Verbindung an `backend/progress.php` nachgereicht (Konflikte lokal vs. DB lösen = aufwändigster Teil).
4. **Update-Flow:** Nach jedem Deploy muss ein „♻️ Update verfügbar"-Toast die Nutzer zum Neuladen bewegen — sonst hängen sie auf alten gecachten `?v=`-Builds.
5. **Online-bleibt-Online:** DB-Sync und 💬-Feedback brauchen Netz (klar als Offline-Hinweis/Chip kommunizieren).

**Aufwand:** Grundversion (Punkte 1, 2 & 4) ≈ halber Tag · Offline-Write-Queue (Punkt 3 inkl. Sync-Konflikte) ist der große Brocken.

### P7 — Bekanntmachung Zielgruppe 10–14 J. (revidiertes Konzept 🔄)

**Status: ❌ geplant (Konzept final, noch keine Umsetzung)**

**Zielgruppe:** 10–14-Jährige in Österreich (MS/AHS-Unterstufe, 5./6. Klasse).

**Grundprinzip der Revidierung:** Alterslimits regeln die **Account-Erstellung**, nicht wer die Inhalte tatsächlich zu sehen bekommt (geteiltes Familien-Handy, kein Login zum Zuschauen, ältere Geschwister zeigen's weiter). Reichweite bei 10–14-Jährigen entsteht real über genau diese Kanäle — unabhängig vom offiziellen Mindestalter.

#### 📋 Schritte (Checkliste)

| # | Schritt | Status |
|---|---------|--------|
| 7.1 | Link-Vorschauen: OG-/Twitter-Tags + Canonical + `og-image.png` (1200×630) in `index.html` | ✅ |
| 7.2 | Kanäle anlegen: YouTube (Shorts), TikTok, Instagram — Handle/Bio/Link einheitlich | ❌ |
| 7.3 | Video-Pipeline-MVP: Puppeteer (headless) → Blueprint-Reveal → ffmpeg 9:16 (15–25 s) → Overlay + Endcard → Warteschlange | ❌ |
| 7.4 | Hook-Bibliothek: 4 Formate (Countdown, Erwachsenen-Challenge, Streak-Flex, Vorher/Nachher) als Vorlagen | ❌ |
| 7.5 | Wöchentlicher Rhythmus: 30-Sek.-Freigabe → Cross-Post auf 3 Kanäle (~1 Std./Woche) | ❌ |
| 7.6 | Schutz & Recht: Kommentare bei Kinder-Content moderieren/deaktivieren; bezahlte Ads nur ab 13 (EU/AT) | ❌ |
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

**Wöchentlicher Job** (lokal oder GitHub Action mit Puppeteer):

1. Node-Skript ruft **3–5 Generatoren** aus der Generator-Sammlung (`GEN{}` in `app-base.js`) auf
2. **Puppeteer** öffnet die App headless und triggert die vorhandene **Blueprint-Reveal-Animation** (bereits implementiert — von Natur aus „satisfying content“, ein bewährtes TikTok-Genre)
3. **Frame-Recording** während der Animation → **ffmpeg** baut daraus ein **9:16-Vertical-Video** (15–25 Sek.)
4. **Text-Overlay** aus Frage/Hook-Vorlage + Lösung — Hook zuerst, **2 Sek. Pause vor der Auflösung** (Retention-Technik)
5. **Endcard** mit App-Name/Link automatisch angehängt
6. Video + Caption + Hashtag-Set in eine **Warteschlange** ablegen
7. **Kurze manuelle Freigabe** (30 Sek. anschauen, ok?) → dann auf **allen 3 Kanälen gleichzeitig** posten (gleiches Asset, kein Mehraufwand)

**Stack:** Puppeteer + ffmpeg, alles kostenlos — kein bezahlter Dienst nötig.

#### 🪝 Hook-Formate (für 10–14 nachweislich wirksam)

| Hook | Wirkmechanik |
|---|---|
| „Kannst du das in 10 Sekunden lösen?“ | Countdown-Timer eingeblendet, Auflösung als Reveal |
| „Können Erwachsene das? (Mittelschul-Niveau)“ | Doppelter Effekt: Kids teilen's stolz bei Erfolg; Erwachsene, die scheitern, ist von Natur aus shareable |
| „Mein Streak: 47 🔥“ | Screen-Recording der Gamification — Kids lieben Flex-Content |
| Vorher/Nachher | „So erklärt's die Schule“ vs. „So macht's die App“ (Blueprint-Zeichnung) |

#### ⚠️ Zwei operative Punkte (unabhängig von der Strategie-Entscheidung)

1. **Kommentare moderieren oder deaktivieren** — bei Videos mit erkennbar Kinder-Zielgruppe ziehen offene Kommentarspalten unerwünschte Erwachsene an. Reine Schutzmaßnahme.
2. **Bezahlte Werbung (nicht organischer Content)** darf sich in EU/AT rechtlich nicht gezielt an unter 13-Jährige richten — betrifft nur ein späteres Ads-Budget, nicht den organischen Content-Plan.

#### 📅 Realistischer Aufwand

- **Pipeline-MVP (Schritte 1–7):** ca. 2–3 Tage
- **Laufend:** ~1 Std./Woche (Freigabe + Posten auf 3 Kanälen)
- **Erste messbare Reichweite:** realistisch 1–3 Wochen nach Start (TikTok schnell, YouTube Shorts träger)

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

### Wissenswald (🌳) — P4.1
- Über die 🌳-Pille in der Statistikzeile öffnet sich der **Wissenswald als eigene Seite** (wie der Eulenhain): eine Waldwiese mit Sonne, Wolken und **6 Kompetenz-Bäumen** — je Lehrplanbereich: 🌰 Bruch-Baum, 🪙 Prozent-Baum, 📐 Formen-Baum, 📏 Mess-Baum, 🧺 Alltags-Baum, 🔗 Struktur-Baum.
- Jedes **Blatt** in der Krone ist eine genaue Mathe-Kompetenz (alle 47 Übungstypen). Die Blätter färben sich automatisch nach deinem Können: 🟤 blass = noch nie geübt · 🟡 gelb = im Bau (Leiter-Stufe 1–2) · 🟢 grün = sicher (Stufe 3–4) · ✨ gold = gemeistert (Stufe 5) · ⏰ rot = Wiederholung fällig.
- Der **Stamm wächst** mit der Beherrschung des Baums — je mehr du sicher kannst, desto höher ragt er. Über jedem **goldenen Baum** zieht ein Tier ein (Eichhörnchen, Papagei, Biene …).
- **Tippe ein Blatt an**: du siehst den genauen Kompetenztext, den Lehrplan-Code und deine Leiter-Stufe. Ein Klick auf **„🌿 Jetzt üben"** startet sofort den gezielten Fokus-Modus — oben in der Leiste erscheint der 🎯-Fokus-Chip (Antippen beendet ihn wieder).
- Wird ein Baum komplett golden, gibt es Konfetti und einen Banner — Bewegung reduzieren wird respektiert. Der Wissenswald wird **automatisch** aus deinem Wiederholungs-Fortschritt berechnet (keine Extra-Speicherung, geräteübergreifend über dein Konto).

### Feedback
- Der 💬-Button (erscheint nach 10 Sekunden) sendet Aufgabe und Hinweis als öffentliches GitHub-Issue; bitte keine persönlichen Daten angeben.
- Jeden Freitag um 12:00 Uhr erstellt eine KI automatisch eine Wochenauswertung mit Entwicklungsvorschlägen.
- Die Benachrichtigungs-Mail wird über Resend versendet (Repository-Secrets RESEND_API_KEY und MAIL_TO); zusätzlich empfohlen: das Repository mit „All Activity" beobachten und E-Mail-Benachrichtigungen in den GitHub-Einstellungen aktivieren.

### Konto, Datenschutz & Rechtliches
- Registrierung mit Nickname und 4-stelliger PIN; der Fortschritt wird geräteübergreifend gespeichert.
- Datenschutz, Impressum und Nutzungsbedingungen öffnen als Pop-up im Footer.
- Die Registrierung erfordert die Bestätigung „14 Jahre oder älter" bzw. die Erlaubnis eines Erziehungsberechtigten (Art. 8 DSGVO).
