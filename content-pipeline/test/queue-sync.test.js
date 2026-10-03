#!/usr/bin/env node
"use strict";

// @block app — Offline-Write-Queue (5.2 Punkt 3)
//
// Testet die Fortschritts-Warteschlange gegen einen Mock-Server. Es wird
// kein echtes Backend angefasst — geprueft werden Reihenfolge,
// Idempotenz, Konto-Trennung und vor allem die Verlust-Szenarien.
//
// Die Testseite (fixtures/queuepage.html) laedt die ECHTE app-active.js
// und schneidet nur die IIFE-Huelle ab. Nachgebaut wird nichts: eine
// Kopie des Codes waere genau die Stelle, an der sich Test und Produktion
// still unterscheiden und der Test gruen bleibt, waehrend die App kaputt
// ist.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const ROOT = path.join(__dirname, "..", "..");
const puppeteer = require(path.join(ROOT, "content-pipeline/node_modules/puppeteer-core"));
const SEITE = fs.readFileSync(path.join(__dirname, "fixtures/queuepage.html"), "utf8");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function serverStarten() {
  return new Promise(function (fertig) {
    const s = http.createServer(function (req, res) {
      if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(SEITE);
      }
      /* Die echte app-active.js ausliefern — aber ohne IIFE.
       *
       * Die Datei ist mit (function(){ ... })() gekapselt; im Test waeren
       * die Funktionen sonst nicht erreichbar. Statt einen Testhaken in
       * den Produktionscode zu bauen, wird nur die Huelle abgeschnitten.
       * Der Code selbst ist unveraendert — getestet wird das Original.
       * Schlaegt das Abschneiden fehl, bricht der Test laut ab, damit
       * nicht still ein leerer Zustand geprueft wird. */
      if (req.url.indexOf("/app-active.js") === 0) {
        const src = fs.readFileSync(path.join(ROOT, "app-active.js"), "utf8");
        const start = src.indexOf("(function(){");
        const ende = src.lastIndexOf("})();");
        if (start === -1 || ende === -1 || ende <= start) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          return res.end("IIFE-Huelle nicht gefunden — Test trifft nicht mehr die echte Datei");
        }
        const koerper = src.slice(start + "(function(){".length, ende);
        res.writeHead(200, { "Content-Type": "text/javascript" });
        return res.end(koerper);
      }
      res.writeHead(404); res.end("x");
    });
    s.listen(0, "127.0.0.1", function () { fertig(s); });
  });
}

(async function () {
  const server = await serverStarten();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new", args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "networkidle0" });

  const e = [];
  const pruefe = function (n, ok, z) { e.push({ n: n, ok: ok, z: z || "" }); };

  /* 1 — Grundzustand: nichts wartet, nichts wird gesendet. */
  let r = await page.evaluate(function () {
    return { pending: !!window.pendingLesen(), posts: window.__POSTS.length };
  });
  pruefe("ohne Aenderung keine Warteschlange", r.pending === false);
  pruefe("ohne Aenderung kein POST", r.posts === 0, "posts " + r.posts);

  /* 2 — Anmeldung, dann Serverfehler: es MUSS warten. */
  r = await page.evaluate(async function () {
    localStorage.setItem("mathemit_token", "tok-anna");
    localStorage.setItem("mathemit_user", JSON.stringify({ nickname: "anna", id: "anna" }));
    window.__MOCK.status = 500;
    window.__POSTS.length = 0;
    await window.syncProgressToAPI();
    window.pendingMarkieren();
    var p = window.pendingLesen();
    return { wartet: !!p, nutzer: p ? p.nutzer : null,
             chip: document.getElementById("offlineChip").hidden === false };
  });
  pruefe("nach Serverfehler wartet etwas", r.wartet === true);
  pruefe("Warteschlange gehoert dem Konto", r.nutzer === "anna", "nutzer " + r.nutzer);
  pruefe("Chip zeigt die Warteschlange", r.chip === true);

  /* 3 — Online und erfolgreich: die Schlange raeumt sich. */
  r = await page.evaluate(async function () {
    window.__MOCK.status = 200;
    window.__POSTS.length = 0;
    await new Promise(function (f) { window.queueFlushen(f); });
    return { wartet: !!window.pendingLesen(), posts: window.__POSTS.length,
             chip: document.getElementById("offlineChip").hidden };
  });
  pruefe("nach erfolgreichem Senden leer", r.wartet === false);
  pruefe("genau ein POST gesendet", r.posts === 1, "posts " + r.posts);
  pruefe("Chip wieder versteckt", r.chip === true);

  /* 4 — Idempotenz: mehrfaches Senden liefert denselben Stand. */
  r = await page.evaluate(async function () {
    window.state.points = 100;
    window.__MOCK.status = 500;
    await window.syncProgressToAPI(); window.pendingMarkieren();
    window.__MOCK.status = 200;
    window.__POSTS.length = 0;
    for (var i = 0; i < 3; i += 1) { window.pendingMarkieren(); await new Promise(function (f) { window.queueFlushen(f); }); }
    return { punkte: window.__POSTS.map(function (p) { return p.koerper.points; }) };
  });
  pruefe("wiederholtes Senden liefert gleiche Punkte",
    r.punkte.length > 0 && r.punkte.every(function (v) { return v === 100; }), JSON.stringify(r.punkte));
/* 5 — DER VERLUSTFALL. Fremdes Konto darf nichts hochladen. */
  r = await page.evaluate(async function () {
    /* Anna hat offline gearbeitet, meldet sich ab, Bob meldet sich an. */
    window.__MOCK.status = 500;
    window.state.points = 250;
    await window.syncProgressToAPI(); window.pendingMarkieren();
    var gehoertAnna = window.pendingLesen().nutzer;
    localStorage.setItem("mathemit_token", "tok-bob");
    localStorage.setItem("mathemit_user", JSON.stringify({ nickname: "bob", id: "bob" }));
    window.__MOCK.status = 200;
    window.__POSTS.length = 0;
    window.loadProgressFromAPI("tok-bob");
    await new Promise(function (f) { window.setTimeout(f, 80); });
    return {
      gehoertAnna: gehoertAnna,
      postAnzahl: window.__POSTS.length,
      punkte: window.state.points,
      wartet: !!window.pendingLesen(),
      chipText: document.getElementById("offlineChipText").textContent
    };
  });
  pruefe("Annas Warteschlange blieb erhalten", r.gehoertAnna === "anna" && r.wartet === true);
  pruefe("Bobs Anmeldung sendet NICHT Annas Punkte", r.postAnzahl === 0, "posts " + r.postAnzahl);
  pruefe("Bobs Anmeldung ueberschreibt den Local-Stand nicht", r.punkte === 250, "punkte " + r.punkte);
  pruefe("Nutzer wird auf das fremde Konto hingewiesen",
    /anderen Konto/.test(r.chipText), JSON.stringify(r.chipText));

  /* 6 — Gleiches Konto: senden VOR dem Laden. */
  r = await page.evaluate(async function () {
    localStorage.setItem("mathemit_token", "tok-anna");
    localStorage.setItem("mathemit_user", JSON.stringify({ nickname: "anna", id: "anna" }));
    window.__MOCK.status = 500;
    window.state.points = 77;
    await window.syncProgressToAPI(); window.pendingMarkieren();
    window.__MOCK.status = 200;
    var reihenfolge = [];
    var alt = window.apiFetch;
    window.apiFetch = function (endpoint, o) {
      reihenfolge.push(o ? "POST" : "GET");
      return Promise.resolve({ status: "ok", _httpStatus: 200, data: { points: 77, solved: 1 } });
    };
    window.loadProgressFromAPI("tok-anna");
    await new Promise(function (f) { window.setTimeout(f, 150); });
    window.apiFetch = alt;
    return { reihenfolge: reihenfolge, wartet: !!window.pendingLesen() };
  });
  pruefe("gleiches Konto: erst senden, dann laden",
    r.reihenfolge[0] === "POST" && r.reihenfolge[1] === "GET", JSON.stringify(r.reihenfolge));
  pruefe("gleiches Konto: Schlange danach leer", r.wartet === false);

  /* 7 — Kein doppelter Versand bei parallelem Aufruf. */
  r = await page.evaluate(async function () {
    window.__MOCK.status = 500;
    window.state.points = 5;
    await window.syncProgressToAPI(); window.pendingMarkieren();
    window.__MOCK.status = 200;
    window.__POSTS.length = 0;
    await Promise.all([
      new Promise(function (f) { window.queueFlushen(f); }),
      new Promise(function (f) { window.queueFlushen(f); }),
      new Promise(function (f) { window.queueFlushen(f); })
    ]);
    return { posts: window.__POSTS.length };
  });
  pruefe("drei gleichzeitige Aufrufe senden nur einmal", r.posts === 1, "posts " + r.posts);

  await browser.close();
  server.close();

  let schlecht = 0;
  e.forEach(function (x) {
    if (!x.ok) schlecht += 1;
    process.stdout.write((x.ok ? "PASS " : "FAIL ") + x.n + (x.z ? "  [" + x.z + "]" : "") + "\n");
  });
  if (schlecht) { process.stdout.write("QUEUE_FEHLER (" + schlecht + ")\n"); process.exit(1); }
  process.stdout.write("QUEUE_OK (" + e.length + " Tests)\n");
})().catch(function (x) { process.stdout.write("FAIL Lauf: " + x.message + "\n"); process.exit(1); });