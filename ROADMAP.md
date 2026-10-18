# 🗺️ Mathemit — Roadmap

> Ziel: Vollständige Lehrplan-Abdeckung (AHS/MS 2023, Kompetenzbereiche H1–H3, Handlungsbereiche I1–I3)
> mit pädagogischem Support + Feedback-Loop. Aktuelle Version siehe App-Footer bzw. VERSION-Datei.

---

## 📊 Aktueller Stand

| Bereich | Status | Details |
|---------|--------|---------|
| **Generatoren** | ✅ 51 | 15 lehrplangetreue Themen-Modi (H1–H3, I1–I3) |
| **Schwierigkeitsstufen** | ✅ 3 | 🌱 / 🎯 / 🚀 je Generator |
| **Tipp-System** | ✅ | Progressive Offenlegung: Andeuten → Formel/Ansatz → gezielte Korrekturhinweise |
| **Wiederholungstraining** | ✅ | Falsch gelöste Aufgaben gespeichert, über 🔁-Chip bis zum Erfolg wiederholt |
| **Wissens-Ampel (Spaced Repetition)** | ✅ | 🔴 / 🟡 / 🟢 je Generator; rote Modi haben Priorität bei der Aufgabenwahl |
| **Wissensgarten** | ✅ | 6 Kompetenz-Bäume, Reife-Färbung (hellgrün → rot), Fokus-Modus pro Frucht |
| **Eulenhain** | ✅ | Endlose Stufen, eigene Eule pro Stufe, wachsender Baum, Tippen für Show |
| **Feedback** | ✅ | 💬-Button → GitHub-Issue, KI-Wochenanalyse freitags 12:00 CET |
| **PWA / Offline** | ✅ | Installierbar, Offline-Start, Warteschlange für DB-Sync bei Netz-Rückkehr |
| **Qualitätssicherung** | ✅ | Pre-Commit-Check: 58 Generatoren, 21 Topic-Chips, 6 Wissensgarten-Bäume |

---
## 🎯 Die 6 Pflicht-Einbaupunkte jedes Generators

Jeder Generator muss an **allen** 6 Einbaupunkten hängen, sonst ist er unsichtbar oder fällt aus der Gesamtlogik.
Erzwungen durch `scripts/check-generator-surfaces.js` (Commit-Abbruch bei fehlendem Einbaupunkt):

> **Hinweis zum Begriff:** Im Code heißen die Einbaupunkte *surfaces* (englisch). Auf Deutsch meint das nicht die geometrische „Fläche", sondern die sechs Stellen, an denen ein Generator registriert werden muss (Rechenlogik `GEN`, Lehrplan-Zuordnung `CURRICULUM_MAP`, Stufen-Tags `GRADE_TAGS`, Topic-Chip `MODES`, Wissensgarten-Baum `GARTEN_BEREICHE` und der SEO/GEO-Eintrag).

1. **`GEN`** — Rechenlogik (valides Exercise-Objekt, mathematisch korrekt, 200-Läufe-Stabilitätstest)
2. **`CURRICULUM_MAP`** — Lehrplan-Code + Kompetenz-Text
3. **`GRADE_TAGS`** — Stufen-Zuordnung (1–4)
4. **`MODES`** — Echter Topic-Chip (Name, Gruppe, Farben; `group !== null`)
5. **`GARTEN_BEREICHE`** — Wissensgarten-Baum (Kompetenz-Baum)
6. **SEO/GEO** — Eintrag im indexierbaren Abdeckungs-Abschnitt (`index.html`) + `llms.txt`

> **Chip-Philosophie:** Ein eigener Chip entsteht, wenn ein Stoff ein eigener Lehrplan-Schwerpunkt ist
> (z. B. „💰 Prozente & Zinsen“, „⚖️ Gleichungen & Verhältnisse“). Ein Sub-Thema lebt im
> zugehörigen Haupt-Chip (z. B. Pythagoras unter „🔺 Dreiecke“).

---

## 📚 Lehrplan-Abdeckung

> Maßgeblich ist die Soll-Ist-Matrix in [`LEHRPLAN_ABDECKUNG.md`](LEHRPLAN_ABDECKUNG.md)
> (H1 ✅, H2 ⚠️ 3 offen, H3 ⚠️ 2 offen, H4 ⚠️ 2 offen + P1.18, I1–I3 ✅).
> Stand nach Lehrplan-Abgleich: 8 offene Punkte P1.18, P1.19, P1.21–P1.24, P1.26, P1.27.

---
## 🗓️ Roadmap-Phasen

### P1–P3: Kern-Generatoren ✅ abgeschlossen
Alle 51 Generatoren implementiert, registriert und getestet.

### P4: Lernsystem ✅ abgeschlossen

| Schritt | Inhalt | Status |
|-------|--------|--------|
| P4.1 | Wissensgarten — 6 Kompetenz-Bäume mit Reife-Färbung | ✅ |
| P4.2 | Wöchentliche Ziele — 50 Punkte / 20 Aufgaben / 5 Wiederholungen | ✅ |
| P4.3 | Wiederholungstraining — Wissens-Ampel, 🔁-Chip | ✅ |
| P4.4 | Dynamische Lobsprüche via `getMotd()` | ✅ |

### P5: Österreich-Bezug & Polish ✅ abgeschlossen

| Punkt | Inhalt | Status |
|-------|--------|--------|
| 5.1 | Mehr Regionen (Alltag-Generatoren) | ❌ gestrichen — Bestand (10 Alltag-Generatoren) reicht |
| 5.2 | PWA / Offline | ✅ vollständig |
| | • Installierbarkeit (`manifest.webmanifest`, Icons aus `logo.svg`) | ✅ |
| | • Offline-Start (Service Worker, Stale-While-Revalidate) | ✅ |
| | • Offline-Write-Queue (`localStorage`, Sync bei Netz-Rückkehr) | ✅ |
| | • Update-Flow („Neue Version verfügbar“-Toast) | ✅ |
| | • Datenschutz (Art. 8 DSGVO, 14+ Jahre, Erziehungsberechtigte) | ✅ |

### P6: Eulenhain ✅ abgeschlossen
Endlose Stufen, jede Stufe schaltet eine eigene Eule frei (Farbwelt + Animation), wachsender Baum,
Tippen auf eine Eule zeigt ihre Show, nächste Eule wartet als Silhouette. Dauerhaft gespeichert.

### P7: Bekanntmachung & Video-Pipeline ✅ abgeschlossen

| Schritt | Inhalt | Status |
|-------|--------|--------|
| 7.1 | Link-Vorschauen (OG-/Twitter-Tags, Canonical, `og-image.png`) | ✅ |
| 7.2 | Kanäle anlegen: YouTube, TikTok, Instagram (URLs in `CHANNELS.md`) | ✅ |
| 7.3 | Video-Pipeline-MVP: Puppeteer → Blueprint-Reveal → ffmpeg 9:16 (15–25 s) → Overlay + Endcard | ✅ |
| 7.4 | Hook-Bibliothek: 4 Formate (Countdown, Erwachsenen-Challenge, Streak-Flex, Vorher/Nachher) | ✅ |
| | Freigabe per Link (`review-server.js`, Token-geschützt) | ✅ |
| | Erste 3 echten Posts veröffentlicht | ✅ |
| 7.5 | Kommentare bei YouTube deaktiviert (Jugendschutz 10–14 J.) | ✅ |
| 7.6 | Bezahlte Werbung nicht vorgesehen (kein Ads-Budget) | ✅ |

**Kanäle:** YouTube Shorts, TikTok (@mathefit.andybrandy.at), Instagram (@mathemit.andybrandy.at)
**Veröffentlichung bleibt manuell** — der Freigabeschritt ist zwingend, kein automatischer Upload.

### P8: SEO/GEO ✅ abgeschlossen
Indexierbarer Abdeckungs-Abschnitt in `index.html` (Sichtbarer Dokumentfluss, kein `display:none`)
+ `llms.txt` für KI-Crawler (llmstxt.org-Standard, `rel="describedby"`).

---

## 🎨 UX-Optimierung

> Motivation: Bei 51+ Generatoren und 21 Topic-Chips muss die App auch mobil
> (kleines Display, Touch) sofort benutzbar bleiben: Aufgabe + Lösungsfeld immer
> sichtbar, Auflösung klar lesbar, neue Nutzer in < 30 s beim Lernen.

### UX1: Chip-Auswahl mobil optimieren ⬜

**Problem:** 21 Topic-Chips in einer horizontal scrollbaren Leiste (`#chips`,
`overflow-x:auto`) + Stufen-Chips (`#gradeChips`) + Schwierigkeits-Chips
(`#diffChips`) = drei Leisten über der Aufgabe. Mobil schiebt das Board
(Figure + Frage + Antwortfeld) aus dem sichtbaren Bereich; Nutzer müssen
scrollen, um das Lösungsfeld zu erreichen. Zusätzlich: `scrollActiveChip()`
scrollt nur horizontal, die Seite springt trotzdem.

**Ziel:** Aufgabe + Lösungsfeld sind nach Chip-Tap **ohne Scrollen** sichtbar
(First Viewport), mind. auf 360×640.

**Maßnahmen:**
1. Chip-Leiste kompakt: einzeilig, kleinere Pads mobil, Gruppen-Trenner behalten.
2. Stufen- (`#gradeChips`) und Schwierigkeits-Chips (`#diffChips`) in EINE
   Sekundärzeile zusammenfassen oder in ein aufklappbares „Stufe & Niveau“-Feld
   verlagern (Default: letzte Wahl aus `localStorage`).
3. Nach `nextExercise()`: `board.scrollIntoView({block:"nearest"})` nur wenn das
   Antwortfeld außerhalb des Viewports liegt (kein erzwungenes Springen).
4. `position:sticky` für das Board-Panel prüfen (Frage + Antwortfeld bleiben
   beim Scrollen oben fixiert).
5. Akzeptanz: Lighthouse Mobile, 360×640 — Frage + Eingabefeld + Prüfen-Button
   im ersten Viewport nach Chip-Wechsel.

### UX2: Auflösung (richtig/falsch) besser darstellen ⬜

**Problem:** `finishRound()` schreibt Lob/Tadel + rohe `explanation` + Zusatzinfos
in EIN `#feedback`-Div als Fließtext (`msg + explain + extra`). Bei falscher
Antwort stehen Korrektur-Tipp, Wiederholungs-Hinweis und Stufen-Vorschlag
unstrukturiert untereinander; richtige Antworten zeigen nur den Lob-Text.
Mobil schwer scannbar, kein visueller Unterschied zwischen „Was war richtig?“
und „Was lerne ich daraus?“.

**Ziel:** Strukturierte Auflösungs-Karte mit klarer Hierarchie.

**Maßnahmen:**
1. Auflösung als Karte: Kopfzeile (✅ Richtig / ❌ Nicht ganz — Punkte/Serie),
   darunter Rechenweg (`explanation`) als eigener Block, darunter Lern-Hinweis
   (TIPP1 / Korrektur) optisch abgesetzt.
2. Bei falsch: richtige Antwort zusätzlich als eigenständige Zeile
   („Richtig wäre: …“), nicht nur in der MC-Markierung versteckt.
3. Bei richtig (Wiederholung/Leiter): Erfolgsmeldung als Badge, nicht als
   Fließtext-Satz.
4. Stufen-Vorschlag (`step-sug`) als eigene Aktionszeile unter der Karte
   (nicht in der Karte).
5. Farben beibehalten (`ok`/`bad`), Kontraste nach WCAG AA prüfen.

### UX3: Welcome-Screen für neue Nutzer ⬜

**Problem:** Kein Erstbesuchs-Flow (`localStorage`-Check, Intro, Overlay —
Code-Suche negativ). Neue Nutzer landen direkt im Übungs-Board ohne zu wissen,
was Chips, Ampel, Garten und Eulenhain bedeuten. Keine Schüler/Lehrer-Trennung
am Einstieg (nur Klassen-Code im Registrierungs-Formular).

**Ziel:** Erstbesuch → 3 Wege in < 30 s; Wiederbesuch → direkt lernen.

**Maßnahmen:**
1. Erstbesuchs-Erkennung via `localStorage` (`mathemit_seen_v1`); Overlay nur
   beim allerersten Besuch, danach nie wieder (schließbar, „Nicht mehr zeigen“).
2. Drei Optionen im Overlay:
   - **„Sofort loslernen“** → Overlay zu, erste Aufgabe (Default-Chip).
   - **„Einführung (1 Min.)“** → 3–4 Slide-Kurztour: Chips wählen Thema,
     Tipps helfen stufenweise, Ampel/Garten zeigen Fortschritt, Eule belohnt.
   - **„Ich bin Schüler / Ich bin Lehrer“** → Rollenwahl: Schüler → direkt
     lernen; Lehrer → Hinweis auf Klassen-Code + Link auf die Lehrer-Landingpage.
3. Lehrer-Landingpage (`/lehrer.html`, SEO/GEO-optimiert wie `index.html` +
   `llms.txt`-Eintrag): Klassen-Code anlegen, Fortschritt einsehen, Lehrplan-
   Abdeckung H1–H4/I1–I3, Datenschutz (DSGVO, kein Tracking), FAQ für Unterricht.
4. Schüler-Landingpage (`/schueler.html` bzw. Anker auf `index.html`):
   Was ist Mathemit, wie lerne ich (Chips, Tipps, Wiederholung), Punkte/Ränge/Eule.
5. Akzeptanz: Erstbesuch → Klick „Sofort loslernen“ < 30 s messbar;
   Lehrer-Seite indexierbar (Titel, Meta-Description, JSON-LD wie `index.html`).

---

## 🔜 Nächste Schritte

1. **P1.18** `potenzenErweitert` — Zehnerpotenzen/Gleitkomma/negative Exponenten (H1/H2)
2. **P1.19** Indirekte Proportionalität (H2)
3. **P1.21** Binomische Formeln (H2)
4. **P1.22** Lineare Gleichungssysteme 2×2 (H2)
5. **P1.23** Grundkonstruktionen (H3)
6. **P1.24** Lagebeziehungen (H3)
7. **P1.26** Absolute & relative Häufigkeiten (H4)
8. **P1.27** Kreisdiagramm (H4)

---

## 📞 Kontakt & Rechtliches

- **Impressum:** https://mathemit.andybrandy.at/impressum.html
- **Datenschutz:** https://mathemit.andybrandy.at/datenschutz.html
- **AGB / Nutzungsbedingungen:** https://mathemit.andybrandy.at/agb.html
- **Kontakt & Support:** Über die App oder die Website erreichbar
- **DSGVO:** Keine Werbung, kein Tracking, keine Cookies zu Werbezwecken, datensparsame Verarbeitung
