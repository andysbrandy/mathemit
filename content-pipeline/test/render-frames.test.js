#!/usr/bin/env node
"use strict";

/*
 * P7.3.3 — Deterministisches 9:16-Rendering von Frames.
 * Geprüft werden die feste 1080x1920-Bühne, das Manifest, die
 * Denkpause vor der Auflösung und die Bitgleichheit zweier Läufe.
 */

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PIPELINE = path.join(REPO_ROOT, "content-pipeline");
const SELECT = path.join(PIPELINE, "select-exercises.js");
const RENDER_FRAMES = path.join(PIPELINE, "render-frames.js");
const STAGE_TEMPLATE = path.join(PIPELINE, "preview", "stage-916.html");

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

function selectInto(workDir, count) {
  const out = path.join(workDir, "episode.json");
  const args = ["--seed", "p7-3-3", "--difficulty", "2", "--count", String(count || 3), "--out", out];
  const result = run(SELECT, args);
  assert.equal(result.status, 0, result.stderr);
  return out;
}

/* 1 — Die 9:16-Buehne ist fest, ohne externe Ressourcen und ohne aktive App. */
function testStageTemplate() {
  const html = fs.readFileSync(STAGE_TEMPLATE, "utf8");
  assert.ok(html.includes('id="stage"'), "Buehnen-Wurzel fehlt");
  assert.ok(html.includes("<!-- APP_STYLES -->"), "APP_STYLES-Platzhalter fehlt");
  assert.ok(html.includes("<!-- APP_SCRIPT -->"), "APP_SCRIPT-Platzhalter fehlt");
  assert.ok(html.includes('id="episode-data"'), "episode-data-Feld fehlt");
  assert.ok(html.includes('data-content-pipeline-stage="916"'), "9:16-Marker fehlt");
  assert.ok(!/<script[^>]+src=/i.test(html), "Buehne laedt externe Skripte");
  assert.ok(!/<link[^>]+href=(?!\s*["']data:)/i.test(html), "Buehne laedt externe Stylesheets");
  const executable = html.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!executable.includes("app-active.js"), "Buehne darf app-active.js nicht einbinden");
  assert.ok(!/backend\//.test(executable), "Buehne verweist auf das Backend");
  assert.ok(!/setTimeout|requestAnimationFrame/.test(executable),
    "Buehne muss zeitunabhaengig sein (keine Timer)");
  assert.ok(html.includes("__STAGE__"), "deterministisches Buehnenskript fehlt");
}

/* 2 — Optionen und Standardwerte muessen klar validiert werden. */
function testOptions() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p733-"));
  try {
    const fps = run(RENDER_FRAMES, ["--fps", "0"]);
    assert.notEqual(fps.status, 0, "Bildrate 0 muss scheitern");
    assert.match(fps.stderr, /Bildrate/);

    const probe = run(RENDER_FRAMES, ["--probe-every", "0"]);
    assert.notEqual(probe.status, 0, "Stichprobenabstand 0 muss scheitern");
    assert.match(probe.stderr, /Stichprobenabstand/);

    const limit = run(RENDER_FRAMES, ["--limit-frames", "-1"]);
    assert.notEqual(limit.status, 0, "Negatives Frame-Limit muss scheitern");
    assert.match(limit.stderr, /Frame-Limit/);

    const episode = selectInto(workDir);
    const missing = run(RENDER_FRAMES, ["--episode", path.join(workDir, "gibt-es-nicht.json")]);
    assert.notEqual(missing.status, 0, "Fehlende Episode muss scheitern");
    assert.match(missing.stderr, /FEHLER/);

    const outOfRange = run(RENDER_FRAMES, ["--episode", episode, "--index", "99"]);
    assert.notEqual(outOfRange.status, 0, "Index ausserhalb der Episode muss scheitern");
    assert.match(outOfRange.stderr, /außerhalb/);

    const unknown = run(RENDER_FRAMES, ["--gibtsnicht"]);
    assert.notEqual(unknown.status, 0, "Unbekannte Option muss scheitern");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/* 3 — Ohne Chrome muss der Lauf klar abbrechen. */
function testMissingChromeFails() {
  const result = run(RENDER_FRAMES, ["--chrome", "/pfad/zu/nicht/vorhanden", "--limit-frames", "1"]);
  assert.notEqual(result.status, 0, "Nicht vorhandenes Chrome muss scheitern");
  assert.match(result.stderr, /Browser was not found|Chrome|Chromium/);
}
/* 4 — Echter Lauf: Frames, Manifest, Buehne, Pause und Isolation. */
function testRenderFrames() {
  const chrome = CHROME_CANDIDATES.find(function (candidate) { return candidate && fs.existsSync(candidate); });
  if (!chrome) {
    process.stdout.write("SKIP testRenderFrames (kein Chrome/Chromium gefunden)\n");
    return;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p733-"));
  try {
    const episode = selectInto(workDir);
    const out = path.join(workDir, "frames");
    const result = run(RENDER_FRAMES, ["--episode", episode, "--index", "0", "--out", out, "--chrome", chrome]);
    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(result.stdout);
    assert.equal(report.stage.width, 1080, "Buehne muss 1080 breit sein");
    assert.equal(report.stage.height, 1920, "Buehne muss 1920 hoch sein (9:16)");
    assert.equal(report.fps, 30);
    assert.equal(report.totalSeconds, 16);
    assert.equal(report.pauseMs, 2000, "Denkpause muss zwei Sekunden dauern");
    assert.equal(report.complete, true, "vollstaendiger Lauf muss als vollstaendig gelten");
    assert.ok(report.frameCount > 0, "es muss Frames geben");

    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
    assert.equal(manifest.frames.length, manifest.totalFrames);
    assert.deepEqual(manifest.segments.map(function (segment) { return segment.id; }),
      ["hook", "reveal", "pause", "solution", "endcard"]);
    assert.equal(manifest.blockedRequestCount, 0, "Renderer darf kein Netzwerk anfordern");
    assert.equal(manifest.storageItemCount, 0, "Renderer darf keinen Storage anlegen");
    assert.equal(manifest.checks.overflowCount, 0, "nichts darf ueber die Buehne hinausragen");
    assert.equal(manifest.checks.clippedTextCount, 0, "kein Text darf abgeschnitten sein");
    assert.equal(manifest.checks.blackFrameCount, 0, "keine schwarzen Frames");

    /* Jeder Frame ist 1080x1920 und der Hash passt zur Datei. */
    manifest.frames.forEach(function (entry) {
      const bytes = fs.readFileSync(path.join(out, entry.file));
      assert.equal(bytes.length, entry.bytes, "Groesse im Manifest passt nicht: " + entry.file);
      assert.equal(bytes.slice(1, 4).toString("ascii"), "PNG", entry.file + " ist kein PNG");
      assert.equal(bytes.readUInt32BE(16), 1080, entry.file + " ist nicht 1080 breit");
      assert.equal(bytes.readUInt32BE(20), 1920, entry.file + " ist nicht 1920 hoch");
      assert.equal(require("node:crypto").createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    });

    /* Innerhalb der Denkpause bewegt sich nichts mehr. */
    const pause = manifest.segments.find(function (segment) { return segment.id === "pause"; });
    const pauseHashes = new Set(manifest.frames
      .filter(function (entry) { return entry.segment === "pause"; })
      .map(function (entry) { return entry.sha256; }));
    assert.equal(pauseHashes.size, 1, "während der Denkpause muss das Bild stehen bleiben");
    assert.equal(manifest.frames[pause.toFrame].sha256, manifest.frames[pause.fromFrame].sha256);
    assert.equal(manifest.frames[pause.fromFrame - 1].segment, "reveal",
      "der Frame vor der Pause gehört noch zum Reveal");
    assert.equal(manifest.frames[pause.fromFrame].revealProgress, 1,
      "mit der Pause ist die Zeichnung vollständig abgeschlossen");
    assert.equal(manifest.frames[pause.fromFrame].pauseActive, true);
    assert.equal(manifest.frames[pause.fromFrame - 1].pauseActive, false,
      "die Pause gilt erst ab ihrem ersten Frame");
    assert.notEqual(manifest.frames[pause.fromFrame - 1].sha256, manifest.frames[pause.fromFrame].sha256,
      "der Hinweis auf die Denkpause erscheint erst mit der Pause");

    /* Reveal bewegt sich, Start und Ende unterscheiden sich. */
    const revealHashes = new Set(manifest.frames
      .filter(function (entry) { return entry.segment === "reveal"; })
      .map(function (entry) { return entry.sha256; }));
    assert.ok(revealHashes.size > 30, "der Reveal muss sich sichtbar zeichnen");
    assert.notEqual(manifest.frames[0].sha256, manifest.frames[manifest.totalFrames - 1].sha256,
      "Start und Ende duerfen nicht identisch sein");

    /* Die Endcard steht am Ende und wechselt genau einmal das Bild. */
    const endcard = manifest.segments.find(function (segment) { return segment.id === "endcard"; });
    assert.equal(endcard.toFrame + 1, manifest.totalFrames, "Endcard muss den Clip abschliessen");
    assert.ok(endcard.seconds >= 2 && endcard.seconds <= 3, "Endcard muss 2–3 s dauern");
    assert.equal(manifest.frames[endcard.fromFrame - 1].endcardVisible, false,
      "vor der Endcard darf sie noch nicht erscheinen");
    assert.equal(manifest.frames[endcard.fromFrame].endcardVisible, true,
      "mit der Endcard ist sie sichtbar");
    assert.notEqual(manifest.frames[endcard.fromFrame - 1].sha256, manifest.frames[endcard.fromFrame].sha256,
      "der Wechsel auf die Endcard muss am Bild sichtbar sein");
    assert.equal(manifest.frames[manifest.totalFrames - 1].endcardProgress, 1,
      "am letzten Frame ist die Endcard vollstaendig da");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/* 5 — Zwei unabhaengige Laeufe muessen bitgleich sein. */
function testDeterministicAcrossRuns() {
  const chrome = CHROME_CANDIDATES.find(function (candidate) { return candidate && fs.existsSync(candidate); });
  if (!chrome) {
    process.stdout.write("SKIP testDeterministicAcrossRuns (kein Chrome/Chromium gefunden)\n");
    return;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p733-"));
  try {
    const episode = selectInto(workDir);
    const hashes = [];
    ["run-a", "run-b"].forEach(function (name) {
      const result = run(RENDER_FRAMES, [
        "--episode", episode, "--index", "0", "--out", path.join(workDir, name), "--chrome", chrome
      ]);
      assert.equal(result.status, 0, result.stderr);
      hashes.push(JSON.parse(result.stdout).frameSetSha256);
    });
    assert.equal(hashes[0], hashes[1], "zwei Laeufe muessen denselben Frame-Hash liefern");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/* 6 — Ein begrenzter Prueflauf ist als unvollstaendig gekennzeichnet. */
function testLimitFramesIsIncomplete() {
  const chrome = CHROME_CANDIDATES.find(function (candidate) { return candidate && fs.existsSync(candidate); });
  if (!chrome) {
    process.stdout.write("SKIP testLimitFramesIsIncomplete (kein Chrome/Chromium gefunden)\n");
    return;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p733-"));
  try {
    const episode = selectInto(workDir);
    const out = path.join(workDir, "frames");
    const result = run(RENDER_FRAMES, [
      "--episode", episode, "--index", "0", "--out", out, "--chrome", chrome, "--limit-frames", "20"
    ]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.frameCount, 20);
    assert.equal(report.complete, false, "Prueflauf darf nicht als vollstaendig gelten");
    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
    assert.equal(manifest.renderedFrames, 20);
    assert.equal(manifest.totalFrames, 480, "die Zielvorgabe bleibt dokumentiert");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

const tests = [
  testStageTemplate,
  testOptions,
  testMissingChromeFails,
  testRenderFrames,
  testDeterministicAcrossRuns,
  testLimitFramesIsIncomplete
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
process.stdout.write("RENDER_FRAMES_OK (" + tests.length + " Tests)\n");

