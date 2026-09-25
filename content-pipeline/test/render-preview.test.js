#!/usr/bin/env node
"use strict";

/*
 * P7.3.2 — Isolierter Renderer: Prüft die Vorschau gegen echte Aufgaben-Generatoren.
 * Ohne Browser lauffähig (Validierung/Template); der Browserteil wird nur
 * ausgeführt, wenn Chrome/Chromium vorhanden ist.
 */

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PIPELINE = path.join(REPO_ROOT, "content-pipeline");
const SELECT = path.join(PIPELINE, "select-exercises.js");
const RENDER = path.join(PIPELINE, "render-preview.js");
const TEMPLATE = path.join(PIPELINE, "preview", "exercise-preview.html");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
];

function run(script, args, cwd) {
  return childProcess.spawnSync(process.execPath, [script].concat(args), {
    cwd: cwd || PIPELINE,
    encoding: "utf8"
  });
}

function selectInto(workDir, extra) {
  const out = path.join(workDir, "episode.json");
  const args = ["--seed", "p7-3-2", "--difficulty", "2", "--count", "3", "--out", out].concat(extra || []);
  const result = run(SELECT, args);
  assert.equal(result.status, 0, result.stderr);
  return out;
}

/* 1 — Template enthält alle Inline-Platzhalter und bleibt frei von externen Ressourcen. */
function testTemplatePlaceholders() {
  const html = fs.readFileSync(TEMPLATE, "utf8");
  assert.ok(html.includes('id="episode-data"'), "episode-data-Platzhalter fehlt");
  assert.ok(html.includes("<!-- APP_STYLES -->"), "APP_STYLES-Platzhalter fehlt");
  assert.ok(html.includes("<!-- APP_SCRIPT -->"), "APP_SCRIPT-Platzhalter fehlt");
  assert.ok(!/<script[^>]+src=/i.test(html), "Template lädt externe Skripte");
  assert.ok(!/<link[^>]+href=(?!\s*["']data:)/i.test(html), "Template lädt externe Stylesheets");
  assert.ok(html.includes("data-content-pipeline-preview=\"isolated\""), "Isolations-Marker fehlt");
  /* Kommentare dürfen app-active.js nennen, laden dürfen es nie. */
  const executable = html.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!executable.includes("app-active.js"), "Template darf app-active.js nicht einbinden");
  assert.ok(!/index\.html|backend\//.test(executable), "Template verweist auf aktive App oder Backend");
}

/* 2 — Ungültige Aufgaben/Indizes/Optionen müssen klar fehlschlagen. */
function testInvalidInputs() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p732-"));
  try {
    const missing = run(RENDER, ["--episode", path.join(workDir, "gibt-es-nicht.json")]);
    assert.notEqual(missing.status, 0, "Fehlende Episode muss scheitern");
    assert.match(missing.stderr, /FEHLER/);

    const episode = selectInto(workDir);
    const outOfRange = run(RENDER, ["--episode", episode, "--index", "99", "--out", path.join(workDir, "x.png")]);
    assert.notEqual(outOfRange.status, 0, "Index außerhalb der Episode muss scheitern");
    assert.match(outOfRange.stderr, /außerhalb/);

    const badEpisode = path.join(workDir, "kaputt.json");
    fs.writeFileSync(badEpisode, JSON.stringify({ schemaVersion: 99, exercises: [] }));
    const badFormat = run(RENDER, ["--episode", badEpisode, "--out", path.join(workDir, "y.png")]);
    assert.notEqual(badFormat.status, 0, "Falsches Schema muss scheitern");
    assert.match(badFormat.stderr, /FEHLER/);

    const unknown = run(RENDER, ["--gibtsnicht"]);
    assert.notEqual(unknown.status, 0, "Unbekannte Option muss scheitern");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/* 3 — render-preview.js muss eine leere Auswahl klar ablehnen. */
function testMissingChromeFails() {
  const result = run(RENDER, ["--chrome", "/pfad/zu/nicht/vorhanden", "--episode", "work/episode.json"]);
  assert.notEqual(result.status, 0, "Nicht vorhandenes Chrome muss scheitern");
  assert.match(result.stderr, /Browser was not found|Chrome|Chromium/);
}

/* 4 — Echter Browserlauf: rendert, blockiert Netz, schreibt PNG, verändert keinen Storage. */
function testBrowserRender() {
  const chrome = CHROME_CANDIDATES.find(function (candidate) { return candidate && fs.existsSync(candidate); });
  if (!chrome) {
    process.stdout.write("SKIP testBrowserRender (kein Chrome/Chromium gefunden)\n");
    return;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p732-"));
  try {
    const episode = selectInto(workDir);
    const png = path.join(workDir, "previews", "exercise.png");
    const result = run(RENDER, ["--episode", episode, "--index", "0", "--out", png, "--chrome", chrome]);
    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(result.stdout);
    assert.equal(report.generator.length > 0, true, "Generator muss berichtet werden");
    assert.equal(report.width, 1200);
    assert.equal(report.height, 900);
    assert.equal(report.blockedRequestCount, 0, "Renderer darf kein Netzwerk anfordern");
    assert.equal(report.storageItemCount, 0, "Renderer darf keinen Storage anlegen");
    assert.equal(report.storageAccessible, true);
    assert.ok(fs.existsSync(png), "Screenshot fehlt");
    const bytes = fs.readFileSync(png);
    assert.ok(bytes.length > 10000, "Screenshot ist verdächtig klein");
    assert.equal(bytes.slice(1, 4).toString("ascii"), "PNG", "Ausgabe ist kein PNG");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

const tests = [
  testTemplatePlaceholders,
  testInvalidInputs,
  testMissingChromeFails,
  testBrowserRender
];

tests.forEach(function (test) {
  try {
    test();
    process.stdout.write("PASS " + test.name + "\n");
  } catch (error) {
    process.stdout.write("FAIL " + test.name + ": " + error.message + "\n");
    process.exit(1);
  }
});
process.stdout.write("RENDER_PREVIEW_OK (" + tests.length + " Tests)\n");
