# 🗺️ Mathemit — Roadmap zur besten Mathe-Lern-App in Österreich

> Stand: v16 | Ziel: Vollständige Lehrplan-Abdeckung (AHS/MS 2023) mit pädagogischem Support

---

## 📊 Aktueller Stand (v16)

- **40 Generatoren** in 7 Kategorien (Dreiecke, Vierecke, Kreis, Körper, Oberfläche, Brüche, Prozent, Textaufgaben)
- **Österreichischer Lehrplan-Mapping** (Codes H1–H3, I1–I3)
- **4 Level**, Streaks, Basis-Badges, Auth-System
- **Comic-SVG-Engine** (gerundete Silhouetten, dynamische Skizzen)
- **9 Alltag-Textaufgaben** mit Österreich-Bezug

---

## 🏔️ Die 5 Prioritäten

### P1 — Lehrplan-Abdeckung *(größter Hebel)*

| # | Thema | Lehrplan-Code | Status |
|---|-------|---------------|--------|
| 1.1 | Lineare Gleichungen lösen (ax+b=c) | H2.I1 | ❌ |
| 1.2 | Tabellen lesen (Zuordnung) | I3.M1 | ❌ |
| 1.3 | Säulendiagramme lesen | I3.M1 | ❌ |
| 1.4 | Gemischte Zahlen (1 ¾) | H1.I1 | ❌ |
| 1.5 | Bruch ↔ Dezimal-Umrechnung | H1.I1 | ❌ |
| 1.6 | Zinsrechnung / Prozent-Satz | H1.I2 | ❌ |
| 1.7 | Proportionalität (Schattenlänge) | H2.I2 | ❌ |
| 1.8 | Mehrstufige Sachaufgaben (Rechenweg) | I1.M1 | ⚠️ |

### P2 — Schwierigkeitsgrade & Differenzierung

| # | Schritt | Status |
|---|---------|--------|
| 2.1 | 3 Stufen pro Generator (Einstieg/Training/Anforderung) | ❌ |
| 2.2 | Dynamische Anpassung nach Fehlversuchen | ❌ |

### P3 — Pädagogischer Support

| # | Schritt | Status |
|---|---------|--------|
| 3.1 | 3-stufiges Tipp-System (Andeuten → Formel → Rechenweg) | ❌ |
| 3.2 | Fehler-Feedback mit gezielter Korrektur-Hinweis | ❌ |

### P4 — Gamification & Motivation

| # | Schritt | Status |
|---|---------|--------|
| 4.1 | Kompetenz-Baum (Lehrplan-Codes als Skill-Tree) | ❌ |
| 4.2 | Wöchentliche Ziele | ❌ |
| 4.3 | Spaced Repetition (falsche Aufgaben wiederholen) | ❌ |

### P5 — Österreich-Bezug & Polish

| # | Schritt | Status |
|---|---------|--------|
| 5.1 | Mehr Regionen (15+ Alltag-Generatoren) | ❌ |
| 5.2 | PWA / Offline | ❌ |

---

## 🎯 P1 — Konkrete nächste Schritte

### Schritt 1: Lineare Gleichungen (H2.I1) ← HIER STARTEN
- [ ] `genGleichungEinfach()` — ax + b = c, x ∈ ℕ
- [ ] SVG: Waagen-Visualisierung
- [ ] Tipp 1: „Was möchtest du allein auf einer Seite haben?"
- [ ] Test: 200 Läufe, x ganzzahlig positiv

### Schritt 2: Tabellen lesen (I3.M1)
- [ ] `genTabelleLesen()` — einfache Zuordnungstabelle
- [ ] SVG: gerenderte HTML-Tabelle als SVG

### Schritt 3: Säulendiagramme (I3.M1)
- [ ] `genDiagrammBalken()` — Balken auswerten

### Schritt 4–8: Restliche Lücken
- [ ] Gemischte Zahlen, Bruch↔Dezimal, Zinsen, Proportionalität, Mehrstufig

---

## 📝 Konventionen

- Jeder neue Generator: `withCurriculum(key, fn)` + `CURRICULUM_MAP`-Eintrag + `GRADE_TAGS`
- Tests: Node-Harness (`/tmp/mathemit-*.js`) — min. 200 Läufe, Antwort prüfen
- Commits: `P1.x: <Thema> — <kurz>` + Version bump via pre-commit hook
- SVG: dunkelgrau (#444444) für Beschriftungen, Comic-Stil

---

## ✅ Definition of Done

- [ ] Generator erzeugt valides Exercise-Objekt
- [ ] SVG ist wohlgeformt (`<svg` … `</svg>`)
- [ ] Antwort stimmt mathematisch (200 Läufe geprüft)
- [ ] Curriculum-Code + Kompetenz-Text vorhanden
- [ ] In GEN-Registry + MODES-Pool eingetragen
- [ ] Version gebumpt + gepusht