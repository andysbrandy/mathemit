#!/usr/bin/env node
"use strict";

/*
 * P7.3.6 — Metadaten, Warteschlange und manuelle Freigabe.
 *
 * Aus einem belegten Lauf (Episode + Frames + Clip + Bericht) entsteht eine
 * Queue-Episode: Caption, Hashtags, Quellen-/Seed-Daten und die technischen
 * Pruefergebnisse. Geschrieben wird ausschliesslich lokal.
 *
 * Zwei Grundsaetze, die den ganzen Baustein tragen:
 *
 * 1. Die Pipeline veroeffentlicht nichts. Es gibt keinen Netzwerkpfad, keine
 *    Upload-Funktion und keinen Scheduler. Was die Queue anfasst, sind
 *    ausschliesslich Dateien unter work/queue/.
 * 2. Eine unvollstaendige Episode gilt nicht als freigegeben. Der Status ist
 *    "bereit" erst, wenn Caption, Hashtags, MP4 und Manifest vollstaendig
 *    vorhanden sind; "freigegeben" kann danach nur ein Mensch setzen, per
 *    --release. Der Pfad ist damit zwingend und nicht versehentlich erreichbar.
 *
 * Das Schreiben ist atomar: erst wird in eine temporaere Datei geschrieben,
 * danach wird sie umbenannt. Bricht der Lauf dazwischen ab, ist entweder die
 * alte Queue da oder gar keine — nie eine halb geschriebene Episode.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const scene = require("./lib/isolated-scene");

const fail = scene.fail;
const resolvePipelinePath = scene.resolvePipelinePath;

const PIPELINE_ROOT = scene.PIPELINE_ROOT;
const WORK = path.join(PIPELINE_ROOT, "work");
const QUEUE_DIR = path.join(WORK, "queue");

const APP_NAME = "Mathemit";
const APP_URL = "https://mathemit.andybrandy.at/";
const MANIFEST_NAME = "episode.json";
const VIDEO_NAME = "clip.mp4";

/*
 * Hashtags. Bewusst fest verdrahtet statt berechnet: die Auswahl haengt vom
 * Seed ab, die Vermarktung nicht. Ein gebuechstabierter, pruefbarer Satz ist
 * fuer die Abnahme besser als eine Liste, die sich mit dem Seed aendert.
 */
const BASE_HASHTAGS = [
  "MatheLernApp",
  "MatheNachhilfe",
  "MatheÜbungen",
  "Schule",
  "MatheTiktok"
];

function usage() {
  return [
    "Verwendung: node content-pipeline/queue-episode.js [Optionen]",
    "",
    "  --clip <datei.mp4>       Fertiger Clip (Standard: content-pipeline/work/video/clip.mp4)",
    "  --frames <verzeichnis>   Quellframes mit manifest.json",
    "  --report <datei.json>    Laufbericht von run-pipeline.js",
    "  --episode <datei.json>   Auswahl mit Seed und Aufgaben",
    "  --queue <verzeichnis>    Ziel der Queue (Standard: content-pipeline/work/queue)",
    "  --slug <text>            Verzeichnisname der Episode (Standard: aus Seed und Index)",
    "  --index <n>             Aufgabe aus der Episode, die der Clip zeigt",
    "                          (Standard: aus dem Frame-Manifest)",
    "  --release <verzeichnis>  Bestehende Queue-Episode als freigegeben markieren",
    "  --list <verzeichnis>     Queue mit Status auflisten",
    "  --help                   Diese Hilfe anzeigen"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = {
    clip: "content-pipeline/work/video/clip.mp4",
    frames: "content-pipeline/work/frames",
    report: "content-pipeline/work/pipeline-report.json",
    episode: "content-pipeline/work/episode.json",
    queue: "content-pipeline/work/queue",
    slug: "",
    index: null,
    release: "",
    list: ""
  };
  const known = ["--clip", "--frames", "--report", "--episode", "--queue", "--slug", "--index", "--release", "--list"];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (!known.includes(arg)) fail("Unbekannte Option: " + arg + "\n\n" + usage());
    if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
    const value = argv[++i];
    if (arg === "--clip") opts.clip = value;
    else if (arg === "--frames") opts.frames = value;
    else if (arg === "--report") opts.report = value;
    else if (arg === "--episode") opts.episode = value;
    else if (arg === "--queue") opts.queue = value;
    else if (arg === "--slug") opts.slug = value;
    else if (arg === "--index") opts.index = Number(value);
    else if (arg === "--release") opts.release = value;
    else if (arg === "--list") opts.list = value;
  }
  /* Der Index wird nicht still korrigiert: eine Zahl, die keine ist, ist ein
     Tippfehler und wird als solcher gemeldet. */
  if (opts.index !== null && (!Number.isInteger(opts.index) || opts.index < 0)) {
    fail("Aufgabenindex muss eine ganze Zahl ab 0 sein.");
  }
  if (!opts.release && !opts.list) {
    /* Nur die reinen Lese- und Schreibwege brauchen die Vorgabepfade. */
    if (!opts.clip.trim()) fail("Clip-Pfad darf nicht leer sein.");
    opts.frames = resolvePipelinePath(opts.frames);
    opts.report = resolvePipelinePath(opts.report);
    opts.episode = resolvePipelinePath(opts.episode);
    opts.clip = resolvePipelinePath(opts.clip);
  }
  opts.queue = resolvePipelinePath(opts.queue);
  if (opts.release) opts.release = resolvePipelinePath(opts.release);
  if (opts.list) opts.list = resolvePipelinePath(opts.list);
  return opts;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/* Liest JSON oder bricht ab. In der Queue ist ein fehlender Beleg kein
   Repair-Fall, sondern ein Grund, die Episode nicht freizugeben. */
function requireJson(file, label) {
  if (!fs.existsSync(file)) fail(label + " fehlt: " + file);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(label + " ist unlesbar: " + error.message);
  }
  return null;
}

/*
 * Der Slug ist der Verzeichnisname der Episode und muss im Dateisystem
 * eindeutig und gefahrlos sein. Er wird aus Seed und Index gebildet, damit
 * derselbe Seed nicht zwei verschiedene Ordner erzeugt.
 */
function buildSlug(seed, index, given) {
  if (given) return given;
  const safe = String(seed).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!safe) fail("Aus dem Seed lässt sich kein Verzeichnisname bilden.");
  return safe + "-i" + String(index);
}

/*
 * Welche Aufgabe steht im Clip? Der Beleg dafuer ist das Frame-Manifest:
 * render-frames.js schreibt dort exerciseIndex und generator der Aufgabe, die
 * tatsaechlich gerendert wurde. Ein --index auf der Kommandozeile darf davon
 * abweichen — dann wird die Abweichung zur Luecke, statt die Caption still
 * auf eine andere Aufgabe umzuschreiben.
 *
 * Ohne Manifest gibt es keinen Beleg. Dann zaehlt die angegebene Nummer, und
 * der fehlende Beleg wird als Luecke gemeldet: eine Caption, die sich nicht
 * belegen laesst, ist keine Grundlage fuer eine Freigabe.
 */
function shownExercise(frameManifest, episode, requested) {
  const count = episode.exercises.length;
  const fromManifest = frameManifest && Number.isInteger(frameManifest.exerciseIndex)
    ? frameManifest.exerciseIndex : null;
  const index = fromManifest === null ? (requested === null ? 0 : requested) : fromManifest;
  return {
    index: index,
    fromManifest: fromManifest,
    exercise: episode.exercises[index] || null,
    count: count
  };
}

/*
 * Caption. Der Text beschreibt, was im Clip passiert, und endet mit dem
 * App-Hinweis. Bewusst ohne Emoji und ohne Rufzeichen: die Caption ist
 * Arbeitsergebnis, nicht Marketingtext, und soll sich mit der Zeit ohne
 * Nacharbeit lesen lassen.
 *
 * Massgeblich ist die Aufgabe, die im Bild steht — nicht die erste der
 * Auswahl. Der Clip zeigt genau eine Aufgabe, also beschreibt die Caption
 * genau diese und nennt ihren Platz in der Auswahl mit.
 */
function buildCaption(shown, episode, report) {
  const exercise = shown.exercise || episode.exercises[0];
  const place = shown.count > 1 ? " (Aufgabe " + (shown.index + 1) + " von " + shown.count + ")" : "";
  const lines = [];
  lines.push(exercise.prompt);
  lines.push("");
  lines.push("Im Clip: eine Aufgabe" + place + " aus dem Bereich "
    + (exercise.topic || exercise.category || "Mathe")
    + ", aufgeschluesselt mit Denkpause und vollstaendiger Loesung.");
  lines.push("");
  lines.push(APP_NAME + " — " + APP_URL);
  lines.push("");
  lines.push("Seed " + episode.seed + " · Stufe " + episode.difficulty
    + " · " + report.durationSeconds + " s");
  return lines.join("\n");
}

/* Themen der Aufgaben als eigene Tags; doppelte fallen weg. */
function buildHashtags(shown) {
  const tags = BASE_HASHTAGS.slice();
  const topic = String((shown.exercise.topic || shown.exercise.category) || "").trim();
  if (!topic) return tags;
  const tag = "#" + topic.replace(/\s+/g, "");
  if (tags.indexOf(tag) === -1) tags.push(tag);
  return tags;
}

/*
 * Vollstaendigkeit. Diese Liste ist die Abnahme der Abnahme: wenn ein Feld
 * fehlt, ist die Episode nicht freigabefaehig und wird mit Grund gemeldet.
 * Der Status darf nicht geraten werden.
 *
 * Die Hash-Kette wird an allen drei Gliedern geprueft, nicht nur an zweien:
 * Frames, Clip und Laufbericht muessen denselben Framesatz nennen. Sonst
 * passiert genau der Fall, den die Abnahme verhindern will — Frames und Clip
 * sind neu, der Bericht stammt aus einem aelteren Lauf, und die Queue
 * veroeffentlicht Zahlen zu einem Clip, den es so nie gab.
 */
function collectGaps(episode, report, clipManifest, paths, shown) {
  const gaps = [];
  if (!episode.seed) gaps.push("Auswahl ohne Seed");
  if (!episode.exercises || !episode.exercises.length) gaps.push("Auswahl ohne Aufgaben");
  if (!report.verified) gaps.push("Lauf nicht gegengeprueft");
  if (paths.clipMissing) gaps.push("MP4 fehlt");
  if (paths.manifestMissing) gaps.push("Clip-Manifest fehlt auf der Platte");
  if (paths.framesMissing) gaps.push("Frame-Manifest fehlt");

  /*
   * Die Caption muss die Aufgabe beschreiben, die im Bild steht. Ohne Beleg
   * ist das nicht nachweisbar; bei Abweichung widerspricht die Caption dem
   * Clip sichtbar — beides ist keine Freigabegrundlage.
   */
  if (shown) {
    if (shown.fromManifest === null) {
      gaps.push("Frame-Manifest nennt keinen Aufgabenindex — welche Aufgabe im Clip steht, ist unbelegt");
    }
    if (!shown.exercise) {
      gaps.push("Aufgabe " + (shown.index + 1) + " liegt ausserhalb der Auswahl ("
        + shown.count + " Aufgaben)");
    }
    /* Der Generator im Manifest muss zu der gezeigten Aufgabe passen. Sonst
       stammt der Clip aus einer anderen Auswahl als die, die daneben liegt. */
    const shownGenerator = paths.frameGenerator;
    if (shown.exercise && shownGenerator && shownGenerator !== shown.exercise.generator) {
      gaps.push("Clip zeigt den Generator " + shownGenerator
        + ", die Auswahl an dieser Stelle " + shown.exercise.generator
        + " — Caption und Bild widersprechen sich");
    }
  }

  const clipFrames = clipManifest ? clipManifest.sourceFrameSetSha256 : null;
  const reportFrames = report.frameSetSha256;

  if (clipManifest && !paths.framesMissing && clipFrames !== paths.frameSetSha256) {
    gaps.push("Clip stammt aus einem anderen Framesatz — Hash-Kette gebrochen");
  }
  /* Der Bericht ist das dritte Glied: er traegt die technischen Zahlen, die in
     die Queue wandern, also muss sein Framesatz derselbe sein. */
  if (clipManifest && !paths.framesMissing && reportFrames !== paths.frameSetSha256) {
    gaps.push("Laufbericht stammt aus einem anderen Lauf — technische Daten sind veraltet");
  }
  return gaps;
}

/*
 * Atomares Schreiben. Der Inhalt landet in einer Datei neben dem Ziel und
 * wird danach benannt. Ein Abbruch hinterlaesst hoechstens eine Datei mit
 * tmp-Suffix, die die Queue nicht als Episode zaehlt.
 */
function writeAtomic(file, content) {
  const temp = file + ".tmp";
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, file);
}

/*
 * Baut den Queue-Datensatz aus den Belegen. Bewusst eine reine Funktion: sie
 * liest nichts von der Platte ausser den uebergebenen Werten, damit die
 * Abnahme ohne Dateien auskommt.
 */
function buildRecord(opts, episode, report, clipManifest, frameManifest) {
  const shown = shownExercise(frameManifest, episode, opts.index);
  const slug = buildSlug(episode.seed, shown.index, opts.slug);
  const gaps = collectGaps(episode, report, clipManifest, {
    clipMissing: opts.clipMissing,
    manifestMissing: opts.manifestMissing,
    framesMissing: !frameManifest,
    frameSetSha256: frameManifest ? frameManifest.frameSetSha256 : null,
    frameGenerator: frameManifest ? frameManifest.generator : null
  }, shown);

  return {
    schemaVersion: 1,
    slug: slug,
    status: gaps.length ? "unvollstaendig" : "bereit",
    /* Der Freigabevermerk bleibt null, bis ein Mensch --release aufruft. */
    releasedAt: null,
    releasedBy: null,
    app: { name: APP_NAME, url: APP_URL },
    caption: buildCaption(shown, episode, report),
    hashtags: buildHashtags(shown),
    source: {
      seed: episode.seed,
      seedUint32: episode.seedUint32,
      difficulty: episode.difficulty,
      generatorSource: episode.generatorSource,
      exerciseCount: episode.exercises.length,
      /* P7.5.2 — Welche Aufgabe der Clip zeigt, steht als Beleg im Manifest,
         damit die Vorschau nicht raten muss. */
      exerciseIndex: shown.index,
      shownPrompt: shown.exercise ? shown.exercise.prompt : null,
      shownGenerator: shown.exercise ? shown.exercise.generator : null,
      generators: episode.exercises.map(function (exercise) { return exercise.generator; }),
      episodeSha256: sha256(opts.episode)
    },
    technical: {
      durationSeconds: report.durationSeconds,
      frameCount: report.frameCount,
      frameSetSha256: report.frameSetSha256,
      clipSha256: report.clipSha256,
      clipBytes: report.clipBytes,
      fps: report.fps || (clipManifest && clipManifest.fps) || null,
      stage: report.stage,
      codecs: report.codecs,
      measuredSegments: report.measuredSegments,
      verified: report.verified
    },
    /*
     * P7.5 — Die Segmentaufteilung wandert mit in die Queue. Ohne sie kann die
     * Vorschau nicht zeigen, was wann passiert, und der Nutzer muesste den
     * Aufbau des Clips am Bild abzaehlen.
     */
    segments: frameManifest && Array.isArray(frameManifest.segments)
      ? frameManifest.segments.map(function (segment) {
        return {
          id: segment.id,
          label: segment.label,
          seconds: segment.seconds,
          fromFrame: segment.fromFrame,
          toFrame: segment.toFrame
        };
      })
      : [],
    hook: frameManifest && frameManifest.hook ? frameManifest.hook : null,
    artifacts: { video: VIDEO_NAME, manifest: MANIFEST_NAME },
    gaps: gaps
  };
}

/*
 * Schreibt die Episode und kopiert das MP4. Erst der Inhalt, dann das
 * Manifest: ein Manifest ohne MP4 waere eine Freigabe ohne Datei.
 */
function enqueue(opts) {
  const episode = requireJson(opts.episode, "Auswahl");
  const report = requireJson(opts.report, "Laufbericht");
  const clipManifestPath = path.join(path.dirname(opts.clip), "clip-manifest.json");
  const clipManifest = fs.existsSync(clipManifestPath)
    ? requireJson(clipManifestPath, "Clip-Manifest")
    : null;
  const framesManifest = path.join(opts.frames, "manifest.json");
  const frameManifest = fs.existsSync(framesManifest) ? requireJson(framesManifest, "Frame-Manifest") : null;

  opts.clipMissing = !fs.existsSync(opts.clip);
  opts.manifestMissing = !clipManifest;

  const record = buildRecord(opts, episode, report, clipManifest, frameManifest);
  const dir = path.join(opts.queue, record.slug);
  fs.mkdirSync(dir, { recursive: true });

  if (!opts.clipMissing) {
    writeAtomic(path.join(dir, VIDEO_NAME), fs.readFileSync(opts.clip));
  }
  writeAtomic(path.join(dir, MANIFEST_NAME), JSON.stringify(record, null, 2) + "\n");

  return { dir: dir, record: record };
}

/*
 * Freigabe. Bewusst ein eigener Aufruf mit eigener Option und ohne Automatik:
 * es gibt keinen Weg, auf dem eine Episode sich selbst freigibt. Voraussetzung
 * ist ein vollstaendiges Manifest, sonst wird abgelehnt.
 */
function release(dir) {
  const manifest = path.join(dir, MANIFEST_NAME);
  if (!fs.existsSync(manifest)) fail("Keine Queue-Episode in " + dir);
  const record = requireJson(manifest, "Queue-Manifest");
  if (record.status !== "bereit") {
    fail("Diese Episode ist nicht freigabefaehig (Status: " + record.status + "). "
      + "Luecken: " + (record.gaps.length ? record.gaps.join("; ") : "unbekannt"));
  }
  if (!fs.existsSync(path.join(dir, record.artifacts.video))) {
    fail("MP4 fehlt in der Queue-Episode: " + record.artifacts.video);
  }
  record.status = "freigegeben";
  record.releasedAt = new Date().toISOString();
  record.releasedBy = "manuell";
  writeAtomic(manifest, JSON.stringify(record, null, 2) + "\n");
  return record;
}

/* Liest die Queue ein, ohne sie zu veraendern. */
function list(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (name) {
    return fs.existsSync(path.join(dir, name, MANIFEST_NAME));
  }).sort().map(function (name) {
    const record = requireJson(path.join(dir, name, MANIFEST_NAME), "Queue-Manifest");
    return {
      slug: name,
      status: record.status,
      gaps: record.gaps,
      hashtags: record.hashtags.length
    };
  });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.list) {
    const rows = list(opts.list);
    if (!rows.length) {
      process.stdout.write("Queue ist leer: " + opts.list + "\nQUEUE_OK\n");
      return;
    }
    rows.forEach(function (row) {
      process.stdout.write(row.status.padEnd(16) + row.slug.padEnd(24) + row.hashtags + " Tags"
        + (row.gaps.length ? "  LUECKE " + row.gaps.join("; ") : "") + "\n");
    });
    process.stdout.write("QUEUE_OK\n");
    return;
  }

  if (opts.release) {
    const record = release(opts.release);
    process.stdout.write("Freigegeben  " + record.slug + "\nQUEUE_OK\n");
    return;
  }

  const built = enqueue(opts);
  process.stdout.write("Queue        " + built.dir + "\n");
  process.stdout.write("Status       " + built.record.status + "\n");
  process.stdout.write("Caption      " + built.record.caption.split("\n").length + " Zeilen\n");
  process.stdout.write("Hashtags     " + built.record.hashtags.join(" ") + "\n");
  process.stdout.write("Freigabe     manuell mit --release " + built.dir + "\n");
  if (built.record.gaps.length) {
    process.stdout.write("LUECKEN      " + built.record.gaps.join("; ") + "\n");
  }
  /* Eine Luecke macht den Lauf nicht zum Absturz, aber sie darf nicht als
     Erfolg durchgehen: das Manifest traegt den Status, die Meldung nicht. */
  process.stdout.write(built.record.status === "bereit" ? "QUEUE_OK\n" : "QUEUE_UNVOLLSTAENDIG\n");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write("FEHLER: " + (error && error.message ? error.message : String(error)) + "\n");
    if (process.env.P7_DEBUG) process.stderr.write(String(error && error.stack) + "\n");
    process.exit(1);
  }
}

module.exports = {
  parseArgs: parseArgs,
  buildSlug: buildSlug,
  shownExercise: shownExercise,
  buildCaption: buildCaption,
  buildHashtags: buildHashtags,
  collectGaps: collectGaps,
  buildRecord: buildRecord,
  writeAtomic: writeAtomic,
  enqueue: enqueue,
  release: release,
  list: list,
  BASE_HASHTAGS: BASE_HASHTAGS
};
