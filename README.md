# mathemit
mathemit.andybrandy ist eine Lernapplication

## 📣 Kanäle

Clips und Updates laufen auf drei Kanälen. Die **öffentlichen** Kanäle sind für
Besucher gedacht, die **Studio-/Übersichts-Links** für die eigene Verwaltung:

| Kanal | Öffentliche URL | Übersicht / Studio (intern) |
|---|---|---|
| **YouTube** (Shorts) | [youtube.com/channel/UCLYEbAqgnCGcWASkaDOnXjw](https://www.youtube.com/channel/UCLYEbAqgnCGcWASkaDOnXjw) | [Studio – Inhalte](https://studio.youtube.com/channel/UCLYEbAqgnCGcWASkaDOnXjw/content?d=ud) |
| **TikTok** | [tiktok.com/@mathefit.andybrandy.at](https://www.tiktok.com/@mathefit.andybrandy.at) | TikTok-Profil |
| **Instagram** | [instagram.com/mathemit.andybrandy.at](https://www.instagram.com/mathemit.andybrandy.at/) | Instagram-Profil |

> Hinweis: Der TikTok-Handle lautet `mathefit` (nicht `mathemit`), weil
> `mathemit.andybrandy.at` dort nicht frei war.

**Rechtlicher Stand (7.6):** Die Kommentarfunktion wurde **je Plattform einzeln
bewertet**. Bei YouTube ist sie für die Videos deaktiviert, weil offene
Kommentarspalten bei erkennbarer Kinder-Zielgruppe unerwünschte Erwachsene
anziehen. Bezahlte Werbung, die sich gezielt an unter 13-Jährige richtet, ist in
EU/AT unzulässig und daher nicht vorgesehen.

## 🛠️ Entwicklung

- **App:** `index.html`, `app-base.js` (Logik), `app-active.js` (Oberfläche),
  `style-base.css`, `style-active.css` — statisch, kein Build-Schritt.
- **Videowerkstatt:** `content-pipeline/` erzeugt Clips lokal und deterministisch
  ohne Netzwerkzugriff. Details und Testblöcke in
  [`content-pipeline/README.md`](content-pipeline/README.md).
- **Qualität:** Pre-Commit-Hook prüft `app-base.js`/`app-active.js` auf nicht
  deklarierte Variablen (die App läuft mit `"use strict"`), erhöht `VERSION` und
  setzt die Version in den Footer.
- **Roadmap:** [`ROADMAP.md`](ROADMAP.md) · **Kanäle (intern):** [`CHANNELS.md`](CHANNELS.md)

## 🔗 Links

- App: <https://mathemit.andybrandy.at/>
- Datenschutz: [`datenschutz.html`](datenschutz.html) · Impressum:
  [`impressum.html`](impressum.html) · Nutzungsbedingungen:
  [`agb.html`](agb.html)

