#!/usr/bin/env node
"use strict";

// @block pwa — Installierbarkeit & Offline (5.2)
//
// Laeuft im echten Browser mit abgeschaltetem Netz. Ein Syntaxcheck waere
// hier fast wertlos: die typischen Fehler (falscher Cache-Name, Backend
// wird mitgecacht, die ?v=-Query verhindert den Cache-Treffer) fallen
// nur auf, wenn wirklich offline neu geladen wird.
//
// Prueft bewusst NICHT die Offline-Write-Queue (5.2 Punkt 3): die ist
// nicht gebaut. Der Test haelt fest, was heute gilt — Fortschritt geht
// offline nur nach localStorage, und das Backend wird nicht gecacht.

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const PIPELINE = path.join(__dirname, "..");
const REPO = path.join(PIPELINE, "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const TYPEN = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json"
};

function serverStarten() {
  return new Promise(function (fertig) {
    const server = http.createServer(function (req, res) {
      let f = req.url.split("?")[0];
      if (f === "/") f = "/index.html";
      const ziel = path.join(REPO, f);
      /* Fremde Pfade abweisen — der Server steht sonst fuer alles offen. */
      if (!ziel.startsWith(REPO) || !fs.existsSync(ziel) || fs.statSync(ziel).isDirectory()) {
        res.writeHead(404); return res.end("nope");
      }
      res.writeHead(200, { "Content-Type": TYPEN[path.extname(ziel)] || "application/octet-stream" });
      res.end(fs.readFileSync(ziel, "utf8"));
    });
    server.listen(0, "127.0.0.1", function () { fertig(server); });
  });
}

(async function () {
  if (!fs.existsSync(CHROME)) {
    process.stdout.write("PWA_SKIP (kein Chrome — CHROME_PATH nicht setzen)\n");
    process.exit(0);
  }
  const puppeteer = require(path.join(PIPELINE, "node_modules/puppeteer-core"));
  const server = await serverStarten();
  const basis = "http://127.0.0.1:" + server.address().port;

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 800 });
  const fehler = [];
  page.on("pageerror", function (e) { fehler.push("PAGEERROR " + e.message); });

  await page.goto(basis + "/", { waitUntil: "networkidle0" });
  await page.evaluate(function () { return navigator.serviceWorker.ready.then(function () { return true; }); });
  await new Promise(function (r) { setTimeout(r, 1200); });

  const cache = await page.evaluate(async function () {
    const namen = await caches.keys();
    if (!namen.length) return { namen: [], pfade: [] };
    const c = await caches.open(namen[0]);
    const schluessel = await c.keys();
    return { namen: namen, pfade: schluessel.map(function (r) { return new URL(r.url).pathname; }) };
  });
/* Und jetzt das eigentliche Experiment: Netz weg, Seite neu laden. */
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise(function (r) { setTimeout(r, 900); });

  const offline = await page.evaluate(function () {
    var frage = document.getElementById("questionText");
    var chip = document.getElementById("offlineChip");
    return {
      mbDa: typeof window.MB === "object",
      generatoren: window.MB ? Object.keys(window.MB.GEN || {}).length : 0,
      chips: document.querySelectorAll(".chip").length,
      aufgabe: frage ? (frage.textContent || "") : "",
      nochAmLaden: frage ? (frage.textContent || "").indexOf("Lade") === 0 : true,
      svg: document.querySelectorAll("#figureHost svg").length,
      chipSichtbar: !!chip && !chip.hidden,
      worker: !!navigator.serviceWorker.controller
    };
  });
  await page.setOfflineMode(false);
  await browser.close();
  server.close();

  const pruefungen = [
    ["genau ein Cache", cache.namen.length === 1, JSON.stringify(cache.namen)],
    /* Ohne App-Code im Cache startet die App offline nicht. */
    ["app-base.js im Cache", cache.pfade.indexOf("/app-base.js") !== -1],
    ["app-active.js im Cache", cache.pfade.indexOf("/app-active.js") !== -1],
    ["style-base.css im Cache", cache.pfade.indexOf("/style-base.css") !== -1],
    ["style-active.css im Cache", cache.pfade.indexOf("/style-active.css") !== -1],
    ["index.html im Cache", cache.pfade.indexOf("/index.html") !== -1],
    /* Die Rechtsseiten werden per fetch in ein Modal geladen — offline
     * waeren sie sonst genau der Text, den man nicht erreicht. */
    ["datenschutz.html im Cache", cache.pfade.indexOf("/datenschutz.html") !== -1],
    ["impressum.html im Cache", cache.pfade.indexOf("/impressum.html") !== -1],
    ["agb.html im Cache", cache.pfade.indexOf("/agb.html") !== -1],
    /* Gecachter Fortschritt waere stiller Datenverlust: local waere er
     * da, in der DB nicht, und der Nutzer glaubt, alles sei gespeichert. */
    ["Backend NICHT gecacht", cache.pfade.every(function (p) { return p.indexOf("/backend/") === -1; })],
    ["offline: Worker aktiv", offline.worker],
    ["offline: window.MB da", offline.mbDa],
    ["offline: 47 Generatoren", offline.generatoren === 47, "anzahl " + offline.generatoren],
    ["offline: Chips gerendert", offline.chips > 5, "anzahl " + offline.chips],
    ["offline: Aufgabe geladen", offline.aufgabe.length > 3 && !offline.nochAmLaden,
      offline.aufgabe.slice(0, 42)],
    ["offline: Figur gezeichnet", offline.svg > 0],
    ["offline: Hinweis sichtbar", offline.chipSichtbar],
    ["keine JS-Fehler auf der Seite", fehler.length === 0, fehler.join(" | ")]
  ];

  let schlecht = 0;
  pruefungen.forEach(function (p) {
    if (!p[1]) schlecht += 1;
    process.stdout.write((p[1] ? "PASS " : "FAIL ") + p[0] + (p[2] ? "  [" + p[2] + "]" : "") + "\n");
  });
  if (schlecht) {
    process.stdout.write("PWA_FEHLER (" + schlecht + ")\n");
    process.exit(1);
  }
  process.stdout.write("PWA_OK (" + pruefungen.length + " Tests)\n");
})().catch(function (e) {
  process.stdout.write("FAIL PWA-Lauf: " + e.message + "\n");
  process.exit(1);
});