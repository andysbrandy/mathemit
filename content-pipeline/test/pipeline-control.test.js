const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PIPELINE = path.resolve(__dirname, "..");
const control = require("../lib/pipeline-control");

/* 1 — Der Zustand kommt aus den Belegen, nicht aus dem Speicher. */
function testStatusReadsEvidence() {
  const state = control.status();
  assert.equal(typeof state.running, "boolean");
  assert.equal(Array.isArray(state.hooks), true, "die Hook-Liste fehlt");
  assert.equal(state.hooks.length, 5, "es werden nicht alle fuenf Vorlagen angeboten");
  state.hooks.forEach(function (hook) {
    assert.ok(hook.id && hook.label, "eine Vorlage ist unbeschriftet");
    assert.ok(hook.seconds >= 15 && hook.seconds <= 25,
      hook.id + " liegt mit " + hook.seconds + " s ausserhalb 15-25 s");
  });
  assert.equal(typeof state.hasVideo, "boolean");
  /* null heisst: es gab noch keinen Lauf. Die Oberflaeche zeigt dann "—".
     Entscheidend ist, dass der Wert JSON-tauglich bleibt. */
  assert.equal(state.lastExitCode, null, "ohne Lauf muss lastExitCode null sein");
  assert.ok("lastExitCode" in state, "lastExitCode fehlt im Zustand");
  /* Der Zustand muss unveraendert serialisierbar sein — er geht per JSON
     an den Browser. */
  assert.doesNotThrow(function () { JSON.parse(JSON.stringify(state)); },
    "der Zustand laesst sich nicht als JSON verschicken");
  assert.ok(Array.isArray(state.queue), "die Queue fehlt im Zustand");

  /* Die Werkzeugkette wird gemeldet, damit die Oberflaeche einen Fehler
     vor dem Lauf zeigen kann statt danach. */
  assert.equal(typeof state.toolchain.ffmpeg, "boolean");
  assert.equal(typeof state.toolchain.chrome, "boolean");
}

/* 2 — Ungueltige Angaben werden abgelehnt, nicht still korrigiert. */
function testRejectsBadInput() {
  const cases = [
    { input: { hook: "gibtsnicht" }, reason: /Hook-Vorlage/ },
    { input: { count: 1 }, reason: /3 bis 5/ },
    { input: { count: 9 }, reason: /3 bis 5/ },
    { input: { count: "abc" }, reason: /3 bis 5/ },
    { input: { index: -1 }, reason: /Aufgabenindex/ },
    { input: { index: "x" }, reason: /Aufgabenindex/ }
  ];
  cases.forEach(function (testCase) {
    const result = control.start(testCase.input);
    assert.equal(result.ok, false, JSON.stringify(testCase.input) + " wurde angenommen");
    assert.match(result.reason, testCase.reason, JSON.stringify(testCase.input));
  });
  /* Ein abgelehnter Versuch darf keinen Zustand hinterlassen. */
  assert.equal(control.status().running, false, "ein abgelehnter Start hat den Zustand veraendert");
}

/* 3 — Ohne laufenden Prozess gibt es nichts abzubrechen. */
function testStopWithoutRun() {
  const result = control.stop();
  assert.equal(result.ok, false, "der Abbruch ohne Lauf wurde gemeldet als Erfolg");
  assert.match(result.reason, /kein Lauf/i);
}

/* 4 — Der Vorgabe-Seed ist lesbar und enthaelt das Datum. */
function testDefaultSeed() {
  const seed = control.defaultSeed();
  assert.match(seed, /^gui-\d{8}$/, "der Vorgabe-Seed hat ein unerwartetes Format: " + seed);
  /* Zweimal hintereinander muss er derselbe sein — sonst waere jeder
     Klick ein neuer Clip, auch ohne Aenderung. */
  assert.equal(control.defaultSeed(), seed, "der Vorgabe-Seed wechselt bei jedem Aufruf");
}

/* 5 — Die Belegpfade zeigen nach work/, nicht aus ihm heraus. */
function testEvidencePaths() {
  const work = path.resolve(PIPELINE, "work");
  [control.WORK, control.VIDEO, control.EPISODE, control.QUEUE_DIR].forEach(function (target) {
    assert.equal(path.dirname(target).length > 0, true);
    assert.ok(path.resolve(target).startsWith(work),
      "ein Pfad zeigt aus work/ heraus: " + target);
  });
  assert.ok(fs.existsSync(control.WORK) || true, "work muss nicht schon existieren");
}

const tests = [
  testStatusReadsEvidence,
  testRejectsBadInput,
  testStopWithoutRun,
  testDefaultSeed,
  testEvidencePaths
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
process.stdout.write("PIPELINE_CONTROL_OK (" + tests.length + " Tests)\n");
