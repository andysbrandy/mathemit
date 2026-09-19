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
- **Streaks, Basis-Badges, Auth-System**
- **Comic-SVG-Engine** (gerundete Silhouetten, dynamische Skizzen)
- **Geometrisches Eulen-Logo**: blinkt, die Pupillen folgen dem Cursor, die Flügel wedeln bei richtigen Aufgaben („Bewegung reduzieren" wird respektiert)
- **9 Alltag-Textaufgaben** mit Österreich-Bezug

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
| 4.1 | Kompetenz-Baum (Lehrplan-Codes als Skill-Tree) | ❌ |
| 4.2 | Wöchentliche Ziele | ❌ |
| 4.3 | Wiederholungstraining (falsch gelöste Aufgaben exakt wiederholen) | ✅ (Instanz-Speicherung inkl. Original-Grafik, lokal + DB, 🔁-Chip, Erfolgsmeldung) |

### P5 — Österreich-Bezug & Polish

| # | Schritt | Status |
|---|---------|--------|
| 5.1 | Mehr Regionen (15+ Alltag-Generatoren) | ❌ |
| 5.2 | PWA / Offline | ❌ |

### P6 — Eulenhain (endlose Stufen + Eulensammlung)

| # | Schritt | Status |
|---|---------|--------|
| 6.1 | Endlose Stufen: Formel `50·(n−1)·n` (Stufe 2=100, 3=300, 10=4500 …) + Rangtitel alle 5 Stufen, danach endlos mit römischer Zählung („Mathe-Legende II") | ✅ |
| 6.2 | Eulen-Engine: parametrische Eule in Logo-Geometrie, 12 kuratierte Farbwelten → nahtlose Farbton-Rotation (unendlich), 8 Signature-Animationen | ✅ |
| 6.3 | 🦉-Menü „Eulenhain": Baum-Szene (je Zweig 5 Eulen), Antippen zeigt Signatur-Animation + Namen, nächste Eule als Silhouette mit Punktestand, Stufe-1-Eule ab Start | ✅ |
| 6.4 | Persistenz: lokal + `progress.owls` (JSON) geräteübergreifend; Migration: bestehende Nutzer erhalten alle Eulen bis zur aktuellen Stufe automatisch | ✅ |
| 6.5 | Aufstiegs-Feier: Konfetti + Banner mit neuem Eulennamen + Logo-Eule flattert; „Bewegung reduzieren" wird respektiert | ✅ |

> **Live-Migration:** ✅ erledigt — `owls`-Spalte angelegt, `progress.php` deployed; E2E-Test bestätigt (Speichern + Rücklesen von `owls` über die API). Zusätzlich behoben: World4You streicht den `Authorization`-Header → die App sendet nun zusätzlich `X-API-Token`, CORS erlaubt ihn, `backend/.htaccess` reicht Bearer durch (v85).

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

### Eulenhain (🦉) — Stufen & Eulensammlung
- Jede gelöste Aufgabe bringt Punkte; die **Stufen sind endlos** (Stufe 2 bei 100 Punkten, Stufe 3 bei 300, danach steigend). Jede Stufe hat einen Rangtitel (Geometrie-Lehrling, Formen-Geselle …), der alle 5 Stufen wechselt und später durchzählt („Mathe-Legende II").
- **Jede Stufe schaltet eine eigene Eule frei** – ab Stufe 1 gehört dir die erste Eule. Jede Eule hat eine eigene Farbwelt (Rubin, Smaragd, Saphir, Bernstein …) und eine eigene kleine Animation (Flattern, Blinzeln, Wippen, Kopfkippen, Hüpfer, Schlafenszeit, Drehung, Federsträuben).
- Über die 🦉-Pille neben „Rang" öffnet sich der **Eulenhain**: Die gesammelten Eulen sitzen je zu fünft auf einem Ast – der Baum wächst mit jeder neuen Stufe. Tippe eine Eule an und sie zeigt ihre Show.
- Die **nächste Eule** wartet als Silhouette am letzten Ast; darunter steht, wie viele Punkte noch fehlen.
- Beim Stufen-Aufstieg regnet kurz Konfetti und ein Banner verkündet die neue Eule (mit „Bewegung reduzieren" bleibt es ruhig).
- Der Eulenhain wird dauerhaft gespeichert – als Gast im Browser, angemeldet geräteübergreifend.

### Feedback
- Der 💬-Button (erscheint nach 10 Sekunden) sendet Aufgabe und Hinweis als öffentliches GitHub-Issue; bitte keine persönlichen Daten angeben.
- Jeden Freitag um 12:00 Uhr erstellt eine KI automatisch eine Wochenauswertung mit Entwicklungsvorschlägen.
- Die Benachrichtigungs-Mail wird über Resend versendet (Repository-Secrets RESEND_API_KEY und MAIL_TO); zusätzlich empfohlen: das Repository mit „All Activity" beobachten und E-Mail-Benachrichtigungen in den GitHub-Einstellungen aktivieren.

### Konto, Datenschutz & Rechtliches
- Registrierung mit Nickname und 4-stelliger PIN; der Fortschritt wird geräteübergreifend gespeichert.
- Datenschutz, Impressum und Nutzungsbedingungen öffnen als Pop-up im Footer.
- Die Registrierung erfordert die Bestätigung „14 Jahre oder älter" bzw. die Erlaubnis eines Erziehungsberechtigten (Art. 8 DSGVO).
