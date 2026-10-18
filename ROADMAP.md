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
## 🎯 Die 6 Flächen jedes Generators

Jeder Generator muss an **allen** 6 Flächen hängen, sonst ist er unsichtbar oder fällt aus der Gesamtlogik.
Erzwungen durch `scripts/check-generator-surfaces.js` (Commit-Abbruch bei fehlender Fläche):

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

### H1 — Zahlen und Rechnen ✅

| Stoff | Generator-Key | Chip | Status |
|-------|---------------|------|--------|
| Brüche (8 Operationen, gemischte Zahlen, ↔ Dezimal) | `bruchKuerzen`, `bruchAddition`, … | ➗ Brüche | ✅ |
| Prozentwert / Prozentanteil / Zinsen | `prozentVonZahl`, `prozentAnteil`, `zinsrechnung` | 💰 Prozente & Zinsen | ✅ |
| Ganze / negative Zahlen (ℤ) | `ganzeZahlen` | 🔢 Ganze Zahlen | ✅ |
| Potenzen & Wurzeln (Basis) | `potenzenWurzeln` | ⚡ Potenzen & Wurzeln | ✅ P1.15 |
| Teilbarkeit, Primzahlen, kgV / ggT | `teilbarkeit` | ➗ Teilbarkeit | ✅ P1.16 (H1.I1) |
| Einheiten-Umrechnung (Länge / Masse / Geld) | `einheiten` | 📐 Maße & Einheiten | ✅ P1.13 (H1.I3) |

### H2 — Variablen, Funktionen, Gleichungen ⚠️

| Stoff | Generator-Key | Chip | Status |
|-------|---------------|------|--------|
| Lineare Gleichung (ax + b = c) | `gleichungEinfach` | ⚖️ Gleichungen & Verhältnisse | ✅ |
| Direkte Proportionalität | `proportionalitaet` | ⚖️ Gleichungen & Verhältnisse | ✅ |
| Terme vereinfachen / Distributivgesetz | `termeDistributiv` | 🔤 Terme vereinfachen | ⬜ P1.17 |

### H3 — Figuren und Körper ✅

| Stoff | Generator-Key | Chip | Status |
|-------|---------------|------|--------|
| Winkel, Dreiecke, Vierecke (Eigenschaften, Winkelsumme) | … | 📐 Winkel-Baum | ✅ |
| Umfang, Fläche, Körper (Volumen / Oberfläche) | … | 📏 Flächen-Baum | ✅ |
| Kreis | … | ⭕ Kreis-Baum | ✅ |
| **Kongruenz & Konstruktionen** | `kongruenzKonstruktionen` | 🔗 Kongruenz & Konstruktionen | ✅ **neu** |
| Lehrplan-Codes | H3.I1, H3.I2, H3.I5 | | ✅ |

### I1–I3 — Handlungsbereiche ✅

| Bereich | Stoff | Status |
|-------|-------|--------|
| I1 Modellieren | Sachaufgaben, mehrstufig, Österreich-Bezug | ✅ |
| I2 Operieren | Rechenlogik, Verfahren anwenden | ✅ |
| I3 Interpretieren | Tabellen, Diagramme, Mittelwert / Modus / Median, Wahrscheinlichkeit | ✅ |

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

## 🔜 Nächste Schritte

1. **P1.16 Teilbarkeit** — Generator `teilbarkeit` abschließen (Lehrplan H1.I1)
2. **P1.17 Terme** — Generator `termeDistributiv` abschließen (Lehrplan H2)
3. Weitere H2-Algebra-Generatoren (z. B. lineare Gleichungssysteme)
4. H4-Bereich prüfen und ggf. aufbauen, sofern der Lehrplan es vorsieht

---

## 📞 Kontakt & Rechtliches

- **Impressum:** https://mathemit.andybrandy.at/impressum.html
- **Datenschutz:** https://mathemit.andybrandy.at/datenschutz.html
- **AGB / Nutzungsbedingungen:** https://mathemit.andybrandy.at/agb.html
- **Kontakt & Support:** Über die App oder die Website erreichbar
- **DSGVO:** Keine Werbung, kein Tracking, keine Cookies zu Werbezwecken, datensparsame Verarbeitung
