#!/usr/bin/env node
"use strict";

/*
 * P7.3.5 — Durchlauf der gesamten Kette.
 * Vier Stufen, jede mit eigenem Beleg: Auswahl → Frames → MP4 → Gegenprobe.
 * Bricht eine Stufe ab, laufen die folgenden nicht. Am Ende stehen die
 * Hash-Kette und der geprueffte Clip in einem Bericht.
 */

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PIPELINE = __dirname;
const REPO_ROOT = path.resolve(PIPELINE, "..");
const WORK = path.join(PIPELINE, "work");
/* P7.4.1 — die Hook-Vorlage wird hier nur validiert und weitergereicht. */
const timeline = require("./lib/timeline");

const DEFAULT_SEED = "p7-3";
const DEFAULT_DIFFICULTY = "2";
const DEFAULT_COUNT = "3";
const DEFAULT_INDEX = "0";
const FRAMES_DIR = path.join(WORK, "frames");
const VIDEO_DIR = path.join(WORK, "video");
const CLIP = path.join(VIDEO_DIR, "clip.mp4");
const CLIP_MANIFEST = path.join(VIDEO_DIR, "clip-manifest.json");
const REPORT = path.join(WORK, "pipeline-report.json");

/*
 * Abbruch mit klarer Ursache. Wirft statt den Prozess zu beenden, damit
 * sich jede Vorbedingung auch im Test pruefen laesst; main() faengt den
 * Fehler ab und beendet mit derselben Meldung auf stderr und Code 1.
 */
function fail(message) {
  const error = new Error(message);
  error.code = "P7_PIPELINE";
  throw error;
}

function resolve(value) {
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

/* Fuehrt eine Stufe aus; deren Erfolg wird an deren Artefakt geprueft. */
function stage(name, script, args) {
  process.stdout.write("\n=== " + name + " ===\n");
  const result = childProcess.spawnSync(process.execPath, [path.join(PIPELINE, script)].concat(args), {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "inherit"]
  });
  if (result.status !== 0) fail(name + " ist fehlgeschlagen — die Kette stoppt hier.");
  const stdout = String(result.stdout || "");
  process.stdout.write(stdout);
  return stdout;
}

/* Wie stage(), aber die Stufe muss einen JSON-Bericht auf stdout liefern. */
function jsonStage(name, script, args) {
  const stdout = stage(name, script, args);
  try {
    return JSON.parse(stdout);
  } catch (error) {
    fail(name + " hat kein auswertbares JSON geliefert: " + error.message);
  }
}

/*
 * Liest eine JSON-Datei. Fehlt oder ist sie kaputt, wird gemeldet und null
 * geliefert; der Aufrufer entscheidet, ob das ein Abbruch ist. warn ist
 * nur für den Test austauschbar — process.stderr ist in neuem Node ein
 * Getter und lässt sich nicht ersetzen.
 */
function readJson(file, label, warn) {
  const report = warn || function (message) { process.stderr.write(message + "\n"); };
  if (!fs.existsSync(file)) {
    report(label + " fehlt: " + file);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    report(label + " ist unlesbar: " + error.message);
    return null;
  }
}

function fileSha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/*
 * Der Framesatz ist die Grundlage des Clips. Fehlt das Manifest oder ist es
 * unvollstaendig, darf die Kette nicht weiterlaufen: ein Clip aus einem
 * fremden oder verkuerzten Framesatz waere sonst ein scheinbar gueltiges
 * Ergebnis. Deshalb wird hier abgebrochen statt nur gewarnt.
 */
function assertFrameSource(manifest) {
  if (!manifest) fail("Ohne Frame-Manifest gibt es keine belegte Grundlage fuer den Clip.");
  if (manifest.schemaVersion !== 1) fail("Frame-Manifest hat kein unterstütztes Format (schemaVersion 1).");
  if (manifest.complete !== true) {
    fail("Der Framesatz ist unvollständig (" + manifest.renderedFrames + " von " + manifest.totalFrames
      + " Frames) — bitte zuerst mit render-frames.js neu rendern.");
  }
  if (!Array.isArray(manifest.frames) || manifest.frames.length !== manifest.totalFrames) {
    fail("Frame-Manifest zählt " + (manifest.frames ? manifest.frames.length : 0)
      + " Frames, erwartet werden " + manifest.totalFrames + ".");
  }
  return manifest;
}
function usage() {
  return [
    "Verwendung: node content-pipeline/run-pipeline.js [Optionen]",
    "",
    "  --seed <text>          Seed der Episode (Standard: " + DEFAULT_SEED + ")",
    "  --difficulty <0|1|2>   Schwierigkeitsstufe (Standard: " + DEFAULT_DIFFICULTY + ")",
    "  --count <n>            Aufgaben pro Episode (Standard: " + DEFAULT_COUNT + ")",
    "  --index <n>            Aufgabenindex fuer den Clip (Standard: " + DEFAULT_INDEX + ")",
    "  --reuse-frames         Vorhandene Frames wiederverwenden statt neu rendern",
    "  --hook <name>           Hook-Vorlage: " + timeline.HOOK_IDS.join(" | ")
      + " (Standard: " + timeline.DEFAULT_HOOK + ")",
    "  --help                 Diese Hilfe anzeigen"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = {
    seed: DEFAULT_SEED,
    difficulty: DEFAULT_DIFFICULTY,
    count: DEFAULT_COUNT,
    index: DEFAULT_INDEX,
    reuseFrames: false,
    /* P7.4.1 — Hook-Vorlage; Standard ist der bisherige Ablauf. */
    hook: timeline.DEFAULT_HOOK
  };
  const known = ["--seed", "--difficulty", "--count", "--index", "--hook"];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (arg === "--reuse-frames") {
      opts.reuseFrames = true;
      continue;
    }
    if (!known.includes(arg)) fail("Unbekannte Option: " + arg + "\n\n" + usage());
    if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
    const value = argv[++i];
    /* Zahlen werden sofort umgewandelt, damit Vergleiche nicht auf Zufall beruhen. */
    if (arg === "--difficulty") {
      if (!["0", "1", "2"].includes(value)) fail("Schwierigkeit muss 0, 1 oder 2 sein.");
      opts.difficulty = Number(value);
    } else if (arg === "--count" || arg === "--index") {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0) {
        fail(arg + " muss eine ganze Zahl ab 0 sein.");
      }
      opts[arg.slice(2)] = number;
    } else {
      opts[arg.slice(2)] = value;
    }
  }
  if (!opts.seed.trim()) fail("Der Seed darf nicht leer sein.");
  /* P7.4.1 — Unbekannte Vorlage bricht hier ab, nicht erst im Renderer. */
  timeline.hookById(opts.hook);
  return opts;
}
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const episode = resolve(path.join("content-pipeline", "work", "episode.json"));
  const started = Date.now();
  let frames = null;
  let video = null;

  stage("1/4 Aufgabenauswahl", "select-exercises.js", [
    "--seed", opts.seed,
    "--difficulty", opts.difficulty,
    "--count", opts.count,
    "--out", episode
  ]);
  const selection = readJson(episode, "Episode");
  if (!selection) fail("Die Auswahlstufe hat keine Episode geliefert.");
  if (!Array.isArray(selection.exercises) || selection.exercises.length === 0) {
    fail("Die Episode enthaelt keine Aufgaben.");
  }
  if (opts.index >= selection.exercises.length) {
    fail("Index " + opts.index + " liegt ausserhalb der Episode (" + selection.exercises.length + ").");
  }

  if (opts.reuseFrames && fs.existsSync(path.join(FRAMES_DIR, "manifest.json"))) {
    process.stdout.write("\n=== 2/4 Frames (wiederverwendet) ===\n");
  } else {
    /* Veraltete Frames entfernen, damit keine Reste in den Clip geraten. */
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    jsonStage("2/4 Frames", "render-frames.js", [
      "--episode", episode,
      "--index", opts.index,
      "--hook", opts.hook,
      "--out", FRAMES_DIR
    ]);
  }
  /* Das Manifest auf der Platte ist der Beleg — nicht die Bildschirmausgabe. */
  frames = assertFrameSource(readJson(path.join(FRAMES_DIR, "manifest.json"), "Frame-Manifest"));

  video = jsonStage("3/4 Montage", "assemble-video.js", ["--frames", FRAMES_DIR, "--out", CLIP]);

  process.stdout.write("\n=== 4/4 Gegenprobe ===\n");
  const verify = childProcess.spawnSync(
    process.execPath,
    [path.join(PIPELINE, "verify-clip.js"), "--clip", CLIP, "--frames", FRAMES_DIR,
      "--hook", opts.hook],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );
  process.stdout.write(verify.stdout || "");
  if (verify.status !== 0) fail("Die Gegenprobe am Clip ist fehlgeschlagen.");
  if (!/CLIP_CHECK_OK/.test(verify.stdout || "")) {
    fail("Die Gegenprobe hat ihr Ergebnis nicht bestaetigt — ohne CLIP_CHECK_OK gilt der Clip als ungeprueft.");
  }

  /* Die Hash-Kette muss zusammenpassen, sonst ist der Clip ein Fremdkoerper. */
  const clipManifest = readJson(CLIP_MANIFEST, "Clip-Manifest");
  if (!clipManifest) fail("Die Montage hat kein Clip-Manifest geliefert.");
  if (clipManifest.sourceFrameSetSha256 !== frames.frameSetSha256) {
    fail("Der Clip stammt aus einem anderen Framesatz als der aktuelle — Hash-Kette gebrochen.");
  }

  const report = {
    schemaVersion: 1,
    seed: selection.seed,
    selectionSha256: fileSha256(episode),
    exerciseCount: selection.exercises.length,
    frameSetSha256: frames.frameSetSha256,
    frameCount: frames.renderedFrames,
    clipSha256: fileSha256(CLIP),
    clipBytes: fs.statSync(CLIP).size,
    durationSeconds: video.durationSeconds,
    stage: { width: clipManifest.width, height: clipManifest.height },
    codecs: { video: clipManifest.codec, pixFmt: clipManifest.pixFmt, audio: clipManifest.audio },
    measuredSegments: frames.measuredSegments,
    durationMs: Date.now() - started,
    verified: /CLIP_CHECK_OK/.test(verify.stdout || "")
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n");

  process.stdout.write("\n=== Ergebnis ===\n");
  process.stdout.write("Clip            " + CLIP + "\n");
  process.stdout.write("Laufzeit        " + report.durationSeconds + " s, " + report.clipBytes + " Bytes\n");
  process.stdout.write("Frames          " + report.frameCount + " (" + report.frameSetSha256.slice(0, 12) + ")\n");
  process.stdout.write("Clip-SHA256     " + report.clipSha256.slice(0, 12) + "\n");
  process.stdout.write("Pipeline-Lauf   " + (report.durationMs / 1000).toFixed(1) + " s\n");
  process.stdout.write("Bericht         " + REPORT + "\n");
  process.stdout.write("PIPELINE_OK\n");
}

if (require.main === module) {
  /* Der Wurf wird hier zur gewohnten Abbruchmeldung; ohne das wuerde
     node einen Stacktrace zeigen statt der Ursache. */
  try {
    main();
  } catch (error) {
    process.stderr.write("FEHLER: " + (error && error.message ? error.message : String(error)) + "\n");
    process.exit(1);
  }
}

module.exports = {
  parseArgs: parseArgs,
  stage: stage,
  readJson: readJson,
  assertFrameSource: assertFrameSource
};
