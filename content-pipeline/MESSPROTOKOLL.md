# Messprotokoll — Reichweite & Retention je Post

> **Warum diese Datei existiert:** Die Abnahme von 7.4.6 verlangt für jeden
> Post Reichweite und Retention nach 24 Stunden. Ohne Ablage ist diese
> Abnahme nicht erfüllbar — und nach drei Wochen weiß niemand mehr, welcher
> Hook funktioniert. Die Hook-Bibliothek (fünf Vorlagen) ist nur dann mehr
> als eine Sammlung, wenn ihre Wirkung gemessen wird.

**Regel:** Eine Zeile je Kanal, 24 Stunden nach dem Post. Nichts schätzen —
lieber leer lassen als raten.

| Datum | KW | Hook | Kanal | Reichweite | Aufrufe | Ø Retention | Likes | Kommentare | Notiz |
|---|---|---|---|---|---|---|---|---|---|
| _2026-10-02_ | _40_ | _countdown_ | _YouTube_ | _–_ | _–_ | _–_ | _–_ | _–_ | _–_ |
| _2026-10-02_ | _40_ | _countdown_ | _TikTok_ | _–_ | _–_ | _–_ | _–_ | _–_ | _–_ |
| _2026-10-02_ | _40_ | _countdown_ | _Instagram_ | _–_ | _–_ | _–_ | _–_ | _–_ | _–_ |

**Spalten, wenn die Plattform sie nicht liefert:**

- **Aufrufe** — Views je Plattform unterschiedlich benannt (YouTube „Aufrufe",
  TikTok „Videoaufrufe", Instagram „Wiedergaben"). Nur eintragen, was es gibt.
- **Ø Retention** — mean percentage watched, falls ausgewiesen. TikTok zeigt
  es in den Video-Statistiken, YouTube nur bei längeren Formaten. Fehlt die Zahl,
  Feld leer lassen — **nicht aus der Aufrufdauer hochrechnen**.
- **Kommentare** — bei YouTube deaktiviert (7.6), dort also dauerhaft `–`.

---

## Nach vier Wochen auswerten

Sobald mindestens **drei Posts pro Hook** hier stehen, lässt sich sagen, ob die
Rotation aufgeht. Danach zwei sinnvolle Schritte:

1. **Gewinner-Hook verdoppeln.** Wenn ein Hook klar führt, zwei Wochen lang
   nur den posten (`npm run woche -- --hook <name>`) und messen, ob der
   Unterschied hält oder nur Zufall war.
2. **Verlierer streichen.** Eine Vorlage ohne jede Bewegung nach drei Posts
   gehört gestrichen — die Bibliothek soll wachsen, nicht verwässern.

**Erste offene Frage:** Welcher Hook funktioniert bei 10–14-Jährigen besser —
der Countdown mit Zeitdruck oder das Vorher/Nachher? Genau dafür sind beide
da, und genau das weiss heute niemand.