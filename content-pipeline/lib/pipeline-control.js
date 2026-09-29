#!/usr/bin/env node
"use strict";

/*
 * P7.5 — Laufsteuerung der Pipeline fuer die Browser-Oberflaeche.
 *
 * Die Oberflaeche soll einen Lauf starten und danach den Zustand zeigen
 * koennen. Beides gehoert hierher, nicht in die Oberflaeche selbst: so gibt
 * es genau eine Stelle, die weiss, wie ein Lauf entsteht — und die
 * Oberflaeche bleibt austauschbar.
 *
 * Zwei Grundsaetze:
 *
 * 1. Nur einer laeuft gleichzeitig. Ein zweiter Lauf wuerde in dieselben
 *    work/-Ordner schreiben und den ersten zerstoeren. Laeuft schon einer,
 *    wird der neue Wunsch abgelehnt statt beide laufen zu lassen.
 * 2. Der Rueckgabewert ist immer der Beleg auf der Platte, nie die
 *    Bildschirmausgabe. Was die Oberflaeche anzeigt, wird aus dem
 *    pipeline-report.json gelesen, das der Lauf selbst geschrieben hat.
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const timeline = require("./timeline");
const ffmpegRunner = require("./ffmpeg-runner");
const scene = require("./isolated-scene");

/* Die Datei liegt in lib/; __dirname zeigt deshalb eine Ebene zu tief. */
const PIPELINE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(PIPELINE_ROOT, "..");
const WORK = path.join(PIPELINE_ROOT, "work");
const RUN_PIPELINE = path.join(PIPELINE_ROOT, "run-pipeline.js");
const QUEUE_SCRIPT = path.join(PIPELINE_ROOT, "queue-episode.js");
const REPORT = path.join(WORK, "pipeline-report.json");
const EPISODE = path.join(WORK, "episode.json");
const VIDEO = path.join(WORK, "video", "clip.mp4");
const CLIP_MANIFEST = path.join(WORK, "video", "clip-manifest.json");
const QUEUE_DIR = path.join(WORK, "queue");

const MAX_LOG_LINES = 400;

/*
 * Der Zustand des laufenden Prozesses. Bewusst im Modul statt im Server,
 * damit es bei genau einem Prozess genau einen Zustand gibt.
 */
const state = {
  running: false,
  pid: null,
  seed: "",
  hook: "",
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  log: [],
  error: null
};

function pushLog(text) {
  const line = String(text).replace(/\s+$/, "");
  if (!line) return;
  state.log.push(line);
  /* Das Log bleibt ueberschaubar: ein 60-s-Lauf schreibt sonst tausende
     Zeilen in den Arbeitsspeicher eines lang laufenden Servers. */
  if (state.log.length > MAX_LOG_LINES) state.log.splice(0, state.log.length - MAX_LOG_LINES);
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }
}

function defaultSeed() {
  /* Ein Seed aus dem Datum: derselbe Tag ergibt denselben Clip, ein neuer
     Tag einen neuen. Ohne Uhr waere jede zweite Auswahl gleich. */
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  return "gui-" + stamp;
}

/* Die Queue ist ein eigener Schritt nach dem Lauf. */
function fillQueue() {
  try {
    const result = childProcess.spawnSync(process.execPath, [QUEUE_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8"
    });
    if (result.status !== 0) {
      pushLog("Hinweis: Die Queue konnte nicht befuellt werden.");
      pushLog(String(result.stderr || "").trim());
      return false;
    }
    pushLog(String(result.stdout || "").trim());
    return true;
  } catch (error) {
    pushLog("Hinweis: Queue fehlgeschlagen — " + error.message);
    return false;
  }
}

/*
 * Startet die Kette. Der Aufrufer bekommt sofort eine Antwort; der Lauf
 * laeuft im Hintergrund weiter und schreibt seinen Fortschritt nach `state`.
 */
function start(options) {
  const opts = options || {};
  if (state.running) {
    return { ok: false, reason: "Es laeuft bereits ein Lauf (Seed " + state.seed + ")." };
  }
  const seed = String(opts.seed || "").trim() || defaultSeed();
  const hook = String(opts.hook || "").trim() || timeline.DEFAULT_HOOK;
  const count = Number(opts.count || 3);
  const index = Number(opts.index || 0);

  /* Dieselbe Validierung wie an der Kommandozeile, nur frueher: ein
     Tippfehler in der Oberflaeche soll nicht den halben Lauf kosten. */
  let known;
  try {
    known = timeline.hookById(hook);
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  if (!Number.isInteger(count) || count < 3 || count > 5) {
    return { ok: false, reason: "Aufgabenanzahl muss 3 bis 5 sein." };
  }
  if (!Number.isInteger(index) || index < 0) {
    return { ok: false, reason: "Aufgabenindex muss eine ganze Zahl ab 0 sein." };
  }

  state.running = true;
  state.pid = null;
  state.seed = seed;
  state.hook = known.id;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.exitCode = null;
  state.error = null;
  state.log = [];
  pushLog("=== Lauf " + seed + " (Hook " + known.id + ", " + count + " Aufgaben) ===");

  const args = [
    RUN_PIPELINE,
    "--seed", seed,
    "--count", String(count),
    "--index", String(index),
    "--hook", known.id
  ];

  let child;
  try {
    /*
     * detached erzeugt eine eigene Prozessgruppe. Das ist fuer den Abbruch
     * noetig: run-pipeline.js startet selbst Chrome, und ein Signal nur an
     * den Elternprozess liesse die Kinder weiterlaufen — der Lauf meldete
     * "abgebrochen", rendete aber im Hintergrund weiter.
     */
    child = childProcess.spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: process.env,
      detached: true
    });
  } catch (error) {
    state.running = false;
    state.error = "Start fehlgeschlagen: " + error.message;
    state.finishedAt = new Date().toISOString();
    return { ok: false, reason: state.error };
  }
  state.pid = child.pid;

  /* stdout und stderr werden zusammengefuehrt: die Stufen melden ihren
     Fortschritt auf stderr, der Abschluss als JSON auf stdout. */
  const collect = function (chunk) {
    String(chunk).split("\n").forEach(pushLog);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  child.on("error", function (error) {
    state.error = error.message;
    pushLog("FEHLER: " + error.message);
  });

  child.on("close", function (code) {
    state.running = false;
    state.pid = null;
    state.exitCode = code;
    state.finishedAt = new Date().toISOString();
    if (code === 0) {
      fillQueue();
    } else {
      pushLog("FEHLER: Der Lauf endete mit Code " + code + ".");
    }
  });

  return { ok: true, seed: seed, hook: known.id, pid: child.pid };
}

/*
 * Der Zustand fuer die Oberflaeche. Alles kommt aus Dateien, die der Lauf
 * selbst geschrieben hat — die Oberflaeche erfindet nichts und rechnet
 * nichts nach.
 */
function status() {
  const report = readJson(REPORT);
  const clipManifest = readJson(CLIP_MANIFEST);
  const episode = readJson(EPISODE);
  const hasVideo = fs.existsSync(VIDEO);

  let queue = [];
  if (fs.existsSync(QUEUE_DIR)) {
    queue = fs.readdirSync(QUEUE_DIR).filter(function (name) {
      return fs.existsSync(path.join(QUEUE_DIR, name, "episode.json"));
    }).sort().map(function (name) {
      const record = readJson(path.join(QUEUE_DIR, name, "episode.json"));
      return {
        slug: name,
        status: record ? record.status : "unbekannt",
        gaps: record ? record.gaps : [],
        releasedAt: record ? record.releasedAt : null
      };
    });
  }

  /*
   * P7.5 — Die Vorschau auf der Startseite braucht mehr als den Zustand:
   * Aufbau, Caption und Hashtags des zuletzt erzeugten Clips. Sie kommen aus
   * der Queue-Episode, weil der Arbeitsordner nur das gerade Gelaufene kennt
   * und beim naechsten Lauf ueberschrieben wird.
   */
  let latest = null;
  const usable = queue.filter(function (row) { return row.status !== "unvollstaendig"; });
  if (usable.length) {
    const slug = usable[usable.length - 1].slug;
    const record = readJson(path.join(QUEUE_DIR, slug, "episode.json"));
    if (record) {
      latest = {
        slug: slug,
        segments: record.segments || [],
        caption: record.caption || "",
        hashtags: record.hashtags || [],
        hook: record.hook || "",
        technical: record.technical || {}
      };
    }
  }

  /*
   * Der Hook kommt aus den Belegen, nicht aus der Oberflaeche: so zeigt die
   * Seite die Vorlage, mit der der Clip wirklich erzeugt wurde.
   */
  const hook = (report && report.hook) || (clipManifest && clipManifest.hook) || "";

  return {
    running: state.running,
    pid: state.pid,
    current: state.running
      ? { seed: state.seed, hook: state.hook, startedAt: state.startedAt }
      : null,
    lastExitCode: state.exitCode,
    lastError: state.error,
    log: state.log.slice(-120),
    hasVideo: hasVideo,
    videoBytes: hasVideo ? fs.statSync(VIDEO).size : 0,
    report: report,
    clipManifest: clipManifest,
    episodeCount: episode && episode.exercises ? episode.exercises.length : 0,
    hook: hook,
    queue: queue,
    latest: latest,
    hooks: timeline.HOOK_IDS.map(function (id) {
      return {
        id: id,
        label: timeline.hookById(id).label,
        seconds: timeline.buildTimeline(30, id).totalSeconds
      };
    }),
    toolchain: {
      ffmpeg: Boolean(ffmpegRunner.findFfmpeg()),
      chrome: Boolean(scene.findChrome())
    }
  };
}

module.exports = {
  start: start,
  stop: stop,
  status: status,
  defaultSeed: defaultSeed,
  state: state,
  WORK: WORK,
  QUEUE_DIR: QUEUE_DIR,
  VIDEO: VIDEO,
  EPISODE: EPISODE
};

/* Bricht einen laufenden Lauf ab. Das ist noetig, weil ein fehlgeschlagener
   Aufbau sonst bis zum Ende wartet. */
function stop() {
  if (!state.running || !state.pid) return { ok: false, reason: "Es laeuft kein Lauf." };
  try {
    /*
     * Das negative Vorzeichen spricht die ganze Prozessgruppe an. Ohne das
     * blieben die Kindprozesse (Chrome) weiterlaufen und der Abbruch waere
     * nur eine Behauptung.
     */
    process.kill(-state.pid, "SIGTERM");
    pushLog("Abbruch angefordert.");
    return { ok: true };
  } catch (error) {
    /* Die Gruppe ist schon weg — dann ist der Abbruch trotzdem gelungen. */
    if (error.code === "ESRCH") {
      pushLog("Der Lauf war bereits beendet.");
      return { ok: true };
    }
    return { ok: false, reason: "Abbruch fehlgeschlagen: " + error.message };
  }
}

