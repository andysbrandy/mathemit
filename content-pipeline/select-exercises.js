#!/usr/bin/env node
"use strict";

/*
 * P7.3.1 — Deterministische Aufgaben-Auswahl für die Video-Pipeline.
 * Lädt die echten GEN-Funktionen aus app-base.js. Ein Seed bestimmt
 * sowohl die Generatorreihenfolge als auch den Zufall in den Aufgaben.
 */

const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = 1;
const DIFFICULTIES = [1, 2, 3];
const MIN_COUNT = 3;
const MAX_COUNT = 5;
const DEFAULT_SEED = "mathemit-v1";
const DEFAULT_OUT = "content-pipeline/work/episode.json";

function usage() {
  return [
    "Verwendung: node content-pipeline/select-exercises.js [Optionen]",
    "",
    "  --seed <text>          Reproduzierbarer Seed (Standard: " + DEFAULT_SEED + ")",
    "  --difficulty <1|2|3>   Schwierigkeitsstufe (Standard: 2)",
    "  --count <3|4|5>        Aufgaben pro Episode (Standard: 3)",
    "  --generators <a,b,...> Feste Auswahl aus 3–5 MB.GEN-Keys",
    "  --all-generators       Jeden Generator einmal auswählen",
    "  --out <datei.json>     Ausgabe relativ zum Repository-Wurzelverzeichnis oder absolut",
    "  --stdout               JSON nach stdout statt in eine Datei",
    "  --help                 Diese Hilfe anzeigen"
  ].join("\n");
}

function fail(message) {
  process.stderr.write("FEHLER: " + message + "\n");
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    seed: DEFAULT_SEED,
    difficulty: 2,
    count: 3,
    generators: null,
    allGenerators: false,
    out: DEFAULT_OUT,
    stdout: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    } else if (arg === "--stdout") {
      opts.stdout = true;
    } else if (arg === "--all-generators") {
      opts.allGenerators = true;
    } else if (["--seed", "--difficulty", "--count", "--generators", "--out"].includes(arg)) {
      if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
      const value = argv[++i];
      if (arg === "--seed") opts.seed = value;
      if (arg === "--difficulty") opts.difficulty = Number(value);
      if (arg === "--count") opts.count = Number(value);
      if (arg === "--generators") {
        opts.generators = value.split(",").map(function (item) { return item.trim(); }).filter(Boolean);
      }
      if (arg === "--out") opts.out = value;
    } else {
      fail("Unbekannte Option: " + arg + "\n\n" + usage());
    }
  }

  if (typeof opts.seed !== "string" || !opts.seed.trim()) fail("Seed muss eine nicht leere Textzeichenfolge sein.");
  if (!DIFFICULTIES.includes(opts.difficulty)) fail("Schwierigkeitsstufe muss 1, 2 oder 3 sein.");
  if (!Number.isInteger(opts.count) || opts.count < MIN_COUNT || opts.count > MAX_COUNT) {
    fail("Anzahl muss eine ganze Zahl von 3 bis 5 sein.");
  }
  if (opts.generators && opts.generators.length === 0) fail("Generatorliste darf nicht leer sein.");
  if (opts.generators && opts.allGenerators) fail("--generators und --all-generators dürfen nicht kombiniert werden.");
  if (opts.generators) {
    const seen = new Set();
    const duplicate = opts.generators.find(function (key) {
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (duplicate) fail("Generator " + duplicate + " steht mehrfach in der Auswahl.");
  }
  if (!opts.stdout && !opts.out.trim()) fail("Ausgabedatei darf nicht leer sein.");
  return opts;
}

/* xmur3 → mulberry32: kompakt, stabil und ohne externe Abhängigkeit. */
function seedFromString(text) {
  let hash = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return (hash ^= hash >>> 16) >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = out[i];
    out[i] = out[j];
    out[j] = temp;
  }
  return out;
}

function loadMathemit(repoRoot) {
  global.window = {};
  const appPath = path.join(repoRoot, "app-base.js");
  delete require.cache[appPath];
  require(appPath);
  if (!global.window.MB) fail("app-base.js hat window.MB nicht initialisiert.");
  return global.window.MB;
}

/*
 * app-base.js verwendet absichtlich Math.random() in allen GEN-Funktionen.
 * Für die Content-Pipeline wird dieser Aufruf während der reinen Aufgabenerzeugung
 * durch einen seedgebundenen PRNG ersetzt und danach sofort wiederhergestellt.
 */
function withGeneratorRandom(random, callback) {
  const originalRandom = Math.random;
  Math.random = random;
  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function curriculumFor(mb, key) {
  const entry = mb.CURRICULUM_MAP && mb.CURRICULUM_MAP[key];
  return {
    codes: entry && Array.isArray(entry.codes) ? entry.codes.slice() : [],
    competence: entry && entry.kompetenz ? entry.kompetenz : null
  };
}

function isChoiceExercise(exercise) {
  return exercise.inputType === "choice" || exercise.inputType === "mc";
}

function exerciseFor(mb, key, difficulty, index) {
  const exercise = mb.GEN[key](difficulty);
  if (!exercise || typeof exercise !== "object") fail("Generator " + key + " lieferte keine Aufgabe.");
  ["question", "hint", "svg", "badge", "badgeColor", "inputType", "answer", "explanation"].forEach(function (field) {
    if (exercise[field] === undefined || exercise[field] === null || exercise[field] === "") {
      fail("Generator " + key + " liefert kein Pflichtfeld: " + field);
    }
  });
  if (isChoiceExercise(exercise) && (!Array.isArray(exercise.choices) || exercise.choices.length < 2)) {
    fail("Generator " + key + " hat keinen gültigen Auswahlblock.");
  }

  return {
    index: index,
    generator: key,
    difficulty: difficulty,
    topic: exercise.topic || null,
    category: exercise.category || null,
    curriculum: curriculumFor(mb, key),
    prompt: exercise.question,
    hint: exercise.hint,
    answer: exercise.answer,
    choices: isChoiceExercise(exercise) ? exercise.choices.slice() : null,
    inputType: exercise.inputType,
    unit: exercise.unit || null,
    tolerance: exercise.tolerance === undefined ? null : exercise.tolerance,
    explanation: exercise.explanation,
    badge: exercise.badge,
    badgeColor: exercise.badgeColor,
    svg: exercise.svg
  };
}

function buildEpisode(mb, opts) {
  const allKeys = Object.keys(mb.GEN);
  if (opts.generators) {
    const unknown = opts.generators.filter(function (key) { return !Object.prototype.hasOwnProperty.call(mb.GEN, key); });
    if (unknown.length) fail("Unbekannte Generatoren: " + unknown.join(", "));
    if (opts.generators.length < MIN_COUNT) fail("Eine Whitelist muss mindestens 3 Generatoren enthalten.");
    if (opts.generators.length > MAX_COUNT) fail("Eine Whitelist darf höchstens 5 Generatoren enthalten.");
  }
  if (opts.allGenerators && allKeys.length < MIN_COUNT) fail("Zu wenige Generatoren für --all-generators.");

  const seedUint = seedFromString(opts.seed);
  const selectionRandom = mulberry32((seedUint ^ 0xA341316C) >>> 0);
  const generatorRandom = mulberry32((seedUint ^ 0xC8013EA4) >>> 0);
  let pool;
  let count;
  if (opts.generators) {
    if (opts.count > opts.generators.length) fail("--count darf nicht größer als die Generatorliste sein.");
    pool = shuffled(opts.generators, selectionRandom);
    count = opts.count;
  } else if (opts.allGenerators) {
    pool = shuffled(allKeys, selectionRandom);
    count = allKeys.length;
  } else {
    pool = shuffled(allKeys, selectionRandom);
    count = opts.count;
  }

  return withGeneratorRandom(generatorRandom, function () {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatorSource: "app-base.js",
      seed: opts.seed,
      seedUint32: seedUint,
      difficulty: opts.difficulty,
      count: count,
      exercises: pool.slice(0, count).map(function (key, index) {
        return exerciseFor(mb, key, opts.difficulty, index);
      })
    };
  });
}

function serialise(episode) {
  return JSON.stringify(episode, null, 2) + "\n";
}

function writeAtomic(outPath, content) {
  const absolute = path.resolve(outPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temp = absolute + ".tmp-" + process.pid;
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, absolute);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, "..");
  const mb = loadMathemit(repoRoot);
  const episode = buildEpisode(mb, opts);
  const content = serialise(episode);

  if (opts.stdout) {
    process.stdout.write(content);
  } else {
    const absolute = path.isAbsolute(opts.out) ? opts.out : path.resolve(repoRoot, opts.out);
    writeAtomic(absolute, content);
    process.stderr.write("Episode erstellt: " + absolute + " (" + episode.exercises.length + " Aufgaben, Seed " + JSON.stringify(opts.seed) + ")\n");
  }
}

if (require.main === module) main();

module.exports = {
  buildEpisode: buildEpisode,
  loadMathemit: loadMathemit,
  mulberry32: mulberry32,
  parseArgs: parseArgs,
  seedFromString: seedFromString,
  serialise: serialise
};
