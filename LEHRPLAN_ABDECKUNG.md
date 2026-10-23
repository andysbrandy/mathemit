# 📚 Mathemit — Lehrplan-Abdeckung (Soll-Ist-Matrix)

> **Die einzige maßgebliche Quelle für die Lehrplan-Vollständigkeit.**
> Grundlage: BMBWF Lehrplan 2023, Mathematik AHS-Unterstufe / Mittelschule
> (Kompetenzbereiche H1–H4, Handlungsbereiche I1–I3 — siehe `LEHRPLAN`-Objekt in `app-base.js`).
> Die ROADMAP.md verweist hierher und enthält keine eigene Stoffliste mehr.
> Stand: aktuell (siehe `VERSION`). Legende: ✅ umgesetzt · ⬜ offen (mit P-Nummer) · 🔶 teilweise.

## H1 — Zahlen und Maße ✅ (Basis vollständig, Erweiterung offen)

| Lehrplan-Soll | Generator-Ist | Status |
|---|---|---|
| Natürliche Zahlen, Stellenwert, Runden | (implizit in allen Zahl-Gen.) | ✅ |
| Brüche: kürzen/erweitern, 4 Operationen, Vergleich, gemischt, ↔ Dezimal | `bruchKuerzen`, `bruchAddition`, `bruchAdditionVerschNenner`, `bruchVergleich`, `bruchMultiplikation`, `bruchDivision`, `gemischteZahlen`, `bruchDezimal` | ✅ |
| Prozent: Prozentwert/-anteil, Zinsen | `prozentVonZahl`, `prozentAnteil`, `zinsrechnung` | ✅ |
| Ganze/negative Zahlen (ℤ) | `ganzeZahlen` | ✅ |
| Potenzen & Wurzeln (Basis) | `potenzenWurzeln` | ✅ |
| Teilbarkeit, Primzahlen, kgV/ggT | `teilbarkeit` | ✅ |
| Maßeinheiten (Länge/Masse/Geld) | `einheiten` | ✅ |
| Zehnerpotenzen, Gleitkomma, negative Exponenten | `potenzenErweitert` | ✅ P1.18 |

## H2 — Variable, funktionale Zusammenhänge ✅

| Lehrplan-Soll | Generator-Ist | Status |
|---|---|---|
| Lineare Gleichung ax + b = c | `gleichungEinfach` | ✅ |
| Direkte Proportionalität | `proportionalitaet` | ✅ |
| Terme vereinfachen / Distributivgesetz | `termeDistributiv` | ✅ |
| Lineare Funktionen (Steigung, Achsenabschnitt) | `lineareFunktionen` | ✅ |
| Indirekte Proportionalität | `indirekteProportionalitaet` | ✅ P1.19 |
| Binomische Formeln | `binomischeFormeln` | ✅ P1.21 |
| Lineare Gleichungssysteme 2×2 | `lineareGleichungssysteme` | ✅ P1.22 |

## H3 — Geometrische Figuren und Körper ✅

| Lehrplan-Soll | Generator-Ist | Status |
|---|---|---|
| Winkel, Winkelsummen, Erkennen, Eigenschaften | `dreieckWinkel`, `viereckWinkel`, `dreieckErkennen`, `viereckErkennen`, `eigenschaftenDreieck`, `eigenschaftenViereck` | ✅ |
| Umfang & Fläche (Dreieck, Viereck, Parallelogramm, Trapez, Kreis) | `dreieckUmfang`, `viereckUmfang`, `dreieckFlaeche`, `rechteckFlaeche`, `parallelogrammFlaeche`, `trapezFlaeche`, `kreisUmfang`, `kreisFlaeche` | ✅ |
| Pythagoras | `pythagoras` | ✅ |
| Volumen & Oberfläche (Quader, Würfel, Zylinder + Pyramide/Prisma/Kegel/Kugel) | `quaderVolumen`, `wuerfelVolumen`, `zylinderVolumen`, `weitereKoerper`, `quaderOberflaeche`, `wuerfelOberflaeche`, `zylinderOberflaeche` | ✅ |
| Kongruenz & Ähnlichkeit | `kongruenzKonstruktionen` | ✅ |
| Grundkonstruktionen (Strecken-/Winkelsymmetrale) | `grundkonstruktionen` | ✅ P1.23 |
| Lagebeziehungen Punkt/Gerade, Gerade/Gerade | `lagebeziehungen` | ✅ P1.24 |

## H4 — Statistische Darstellungen und Kenngrößen ✅

| Lehrplan-Soll | Generator-Ist | Status |
|---|---|---|
| Tabellen & Balkendiagramme lesen | `tabelleLesen`, `diagrammBalken` | ✅ |
| Wahrscheinlichkeit (Laplace) | `wahrscheinlichkeit` | ✅ |
| Mittelwert / Modus / Median | `mittelwerte` | ✅ |
| Absolute & relative Häufigkeiten | `haeufigkeit` | ✅ P1.26 |
| Kreisdiagramm lesen & zeichnen | `kreisdiagramm` | ✅ P1.27 |

## I1–I3 — Handlungsbereiche ✅

| Bereich | Abdeckung | Status |
|---|---|---|
| I1 Darstellen/Modellbilden | Sachaufgaben, mehrstufig, Alltag/Österreich-Bezug | ✅ |
| I2 Rechnen/Operieren | Rechenlogik, Verfahren in allen Generatoren | ✅ |
| I3 Interpretieren | Tabellen, Diagramme, Kenngrößen, Wahrscheinlichkeit | ✅ |

## Offene Punkte (0)

Alle Lehrplan-Bereiche H1–H4, I1–I3 sind vollständig abgedeckt.
