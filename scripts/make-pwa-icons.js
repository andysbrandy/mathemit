#!/usr/bin/env node
"use strict";

/*
 * make-pwa-icons.js — erzeugt die PWA-Icons aus logo.svg.
 *
 * Warum ein Generator und nicht fertige PNGs im Repo: die Icons muessen
 * zum Logo passen, das sich mit der App bewegt. Ein Generator laeuft in
 * Sekunden und ist nachvollziehbar; fertige PNGs liegen irgendwann da
 * und passen zu nichts mehr.
 *
 * Warum ueberhaupt neue Icons statt avatar.png: das Avatar traegt das
 * Wortzeichen "mathemit .andybrandy.at". Bei 48x48 (der Groesse, in der
 * Android-Symbole angezeigt werden) ist davon nichts mehr zu lesen —
 * es bliebe ein dunkles Rechteck. Fuer ein App-Symbol zaehlt die Silhouette,
 * nicht der Schriftzug.
 *
 * Aufruf:  node scripts/make-pwa-icons.js
 */

const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const SVG = fs.readFileSync(path.join(REPO, "logo.svg"), "utf8");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* Hintergrund = --ink aus style-base.css. Das ist die Farbe, die auch die
 * Statusleiste im Standalone-Modus bekommt, sonst bricht der Rand sichtbar. */
const HINTERGRUND = "#1F2E45";

/*
 * maskable: Das sichere Feld ist ein Kreis von 80% der Kantenlaenge. Alles
 * ausserhalb wird vom Android-Launcher zensiert. Die Eule sitzt dort
 * kleiner, damit Fluegel und Fuesse nicht abgeschnitten werden.
 */
const ZIEL = [
  { datei: "icon-192.png", groesse: 192, anteil: 0.74, maskable: false },
  { datei: "icon-512.png", groesse: 512, anteil: 0.74, maskable: false },
  { datei: "icon-maskable-512.png", groesse: 512, anteil: 0.58, maskable: true }
];

function seiteHTML(groesse, anteil) {
  /* Die SVG hat viewBox="-12 0 124 100" — leicht unsymmetrisch. Ohne den
   * Versatz saehe die Eule in der Mitte des Icons aus, weil der Schnabel
   * genau in der Mitte sitzt und nicht das optische Zentrum ist. */
  const innen = Math.round(groesse * anteil);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:${HINTERGRUND};}
    .box{width:${groesse}px;height:${groesse}px;display:flex;align-items:center;
         justify-content:center;background:${HINTERGRUND};}
    .box svg{width:${innen}px;height:auto;display:block;margin-left:${Math.round(innen * 0.02)}px;}
  </style></head><body><div class="box">${SVG}</div></body></html>`;
}

(async function () {
  const puppeteer = require(path.join(REPO, "content-pipeline/node_modules/puppeteer-core"));
  if (!fs.existsSync(CHROME)) {
    process.stderr.write("Chrome nicht gefunden: " + CHROME + "\nSetze CHROME_PATH.\n");
    process.exit(1);
  }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  for (const z of ZIEL) {
    const seite = await browser.newPage();
    await seite.setViewport({ width: z.groesse, height: z.groesse, deviceScaleFactor: 1 });
    const tmp = path.join("/tmp", "pwa-icon-" + z.groesse + ".html");
    fs.writeFileSync(tmp, seiteHTML(z.groesse, z.anteil));
    await seite.goto("file://" + tmp, { waitUntil: "networkidle0" });
    const ziel = path.join(REPO, z.datei);
    await seite.screenshot({ path: ziel, omitBackground: false });
    await seite.close();
    const kb = Math.round(fs.statSync(ziel).size / 1024);
    process.stdout.write("  " + z.datei.padEnd(24) + z.groesse + "px  " + kb + " kB" + (z.maskable ? "  (maskable)" : "") + "\n");
  }
  await browser.close();
  process.stdout.write("Fertig: " + ZIEL.length + " Icons im Repo-Wurzelverzeichnis.\n");
})().catch(function (e) {
  process.stderr.write("FEHLER: " + e.message + "\n");
  process.exit(1);
});