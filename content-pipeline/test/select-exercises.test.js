#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(REPO_ROOT, "content-pipeline", "select-exercises.js");

function run(args, expectFailure, cwd) {
  const result = childProcess.spawnSync(process.execPath, [SCRIPT].concat(args), {
    cwd: cwd || REPO_ROOT,
    encoding: "utf8"
  });
  if (expectFailure) {
    assert.notEqual(result.status, 0, "Ungültige Eingabe muss fehlschlagen");
    assert.match(result.stderr, /FEHLER/);
  } else {
    assert.equal(result.status, 0, result.stderr);
  }
  return result;
}

function testDeterminism() {
  const args = ["--seed", "gleichheitstest", "--difficulty", "2", "--count", "4", "--stdout"];
  const first = run(args);
  const second = run(args);
  assert.equal(first.stdout, second.stdout, "Gleicher Seed muss bytegleiches JSON erzeugen");
  assert.ok(first.stdout.includes('"schemaVersion": 1'));
  assert.ok(first.stdout.includes('"generatorSource": "app-base.js"'));
  assert.equal(JSON.parse(first.stdout).exercises.length, 4);
}

function testSeedsDiffer() {
  const base = ["--difficulty", "2", "--count", "3", "--stdout"];
  const first = JSON.parse(run(["--seed", "woche-1"].concat(base)).stdout);
  const second = JSON.parse(run(["--seed", "woche-2"].concat(base)).stdout);
  assert.notEqual(first.seedUint32, second.seedUint32);
  const firstKeys = first.exercises.map(function (ex) { return ex.generator; });
  const secondKeys = second.exercises.map(function (ex) { return ex.generator; });
  assert.notDeepEqual(firstKeys, secondKeys, "Verschiedene Seeds müssen unterschiedliche Auswahlen liefern");
}

function testFixedWhitelist() {
  const result = JSON.parse(run([
    "--seed", "whitelist", "--difficulty", "3", "--count", "3",
    "--generators", "dreieckFlaeche,gleichungEinfach,bruchAddition", "--stdout"
  ]).stdout);
  assert.deepEqual(result.exercises.map(function (ex) { return ex.generator; }).sort(), [
    "bruchAddition", "dreieckFlaeche", "gleichungEinfach"
  ]);
  assert.ok(result.exercises.every(function (ex) { return ex.difficulty === 3; }));
}

function testAllGeneratorMatrix() {
  [1, 2, 3].forEach(function (difficulty) {
    const result = JSON.parse(run([
      "--seed", "alle-generatoren-" + difficulty, "--difficulty", String(difficulty), "--all-generators", "--stdout"
    ]).stdout);
    assert.equal(result.exercises.length, 47);
    assert.equal(new Set(result.exercises.map(function (ex) { return ex.generator; })).size, 47);
    assert.ok(result.exercises.every(function (ex) { return ex.difficulty === difficulty; }));
    result.exercises.forEach(function (ex) {
      ["prompt", "hint", "svg", "badge", "badgeColor", "inputType", "answer", "explanation"].forEach(function (field) {
        assert.notEqual(ex[field], undefined, ex.generator + " ohne " + field);
        assert.notEqual(ex[field], null, ex.generator + " ohne " + field);
        assert.notEqual(ex[field], "", ex.generator + " ohne " + field);
      });
      assert.ok(ex.svg.includes("<svg") && ex.svg.includes("</svg>"));
    });
  });
}

function testInvalidInputs() {
  run(["--difficulty", "4"], true);
  run(["--count", "2"], true);
  run(["--count", "6"], true);
  run(["--generators", "nichtVorhanden,bruchAddition,gleichungEinfach"], true);
  run(["--generators", "dreieckFlaeche,gleichungEinfach", "--count", "3"], true);
  run(["--all-generators", "--generators", "dreieckFlaeche,gleichungEinfach,bruchAddition"], true);
  run(["--generators", "bruchAddition,bruchAddition,dreieckFlaeche"], true);
}

function testAtomicOutput() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p7-"));
  try {
    const out = path.join(dir, "nested", "episode.json");
    const args = ["--seed", "datei", "--difficulty", "2", "--count", "3", "--out", out];
    run(args);
    run(args);
    const first = fs.readFileSync(out, "utf8");
    run(args);
    assert.equal(fs.readFileSync(out, "utf8"), first, "Datei muss bei jedem Lauf deterministisch bleiben");
    assert.equal(fs.readdirSync(path.dirname(out)).length, 1, "Keine temporäre Datei darf zurückbleiben");
    assert.doesNotThrow(function () { JSON.parse(first); });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testRepositoryRelativeOutput() {
  const relative = "content-pipeline/work/.path-test-" + process.pid + ".json";
  const expected = path.join(REPO_ROOT, relative);
  try {
    run(["--seed", "pfad", "--difficulty", "2", "--count", "3", "--out", relative], false, path.join(REPO_ROOT, "content-pipeline"));
    assert.doesNotThrow(function () { JSON.parse(fs.readFileSync(expected, "utf8")); });
  } finally {
    fs.rmSync(expected, { force: true });
  }
}

const tests = [testDeterminism, testSeedsDiffer, testFixedWhitelist, testAllGeneratorMatrix, testInvalidInputs, testAtomicOutput, testRepositoryRelativeOutput];
let failed = 0;
tests.forEach(function (test) {
  try {
    test();
    process.stdout.write("PASS " + test.name + "\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL " + test.name + ": " + (error.stack || error.message) + "\n");
  }
});
if (failed) process.exit(1);
process.stdout.write("SELECT_EXERCISES_OK (" + tests.length + " Tests)\n");
