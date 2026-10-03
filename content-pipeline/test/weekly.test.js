#!/usr/bin/env node
"use strict";

// @block pipeline — Wochenlauf (7.5)
//
// weekly.js orchestriert Fuenf Einzelwerkzeuge. Solange niemand prueft,
// bricht sie irgendwann leise: ein Hook verschwindet aus der Rotation, der
// Seed wird nicht mehr deterministisch, oder die Mail geht an niemanden.
//
// Geprueft wird bewusst die Logik, nicht das Rendern — ein echter Lauf
// dauert Minuten und wuerde die Suite unbrauchbar machen.

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const weekly = require("../weekly.js");

const PIPELINE = path.join(__dirname, "..");
const timeline = require(path.join(PIPELINE, "lib/timeline.js"));

/* 1 — Die Rotation nutzt jede Vorlage und nur Vorlagen, die es gibt. */
function testRotation() {
  assert.ok(weekly.ROTATION.length > 0, "die Rotation ist leer");
  assert.equal(new Set(weekly.ROTATION).size, weekly.ROTATION.length,
    "die Rotation enthaelt einen Hook doppelt");

  timeline.HOOK_IDS.forEach(function (id) {
    assert.ok(weekly.ROTATION.indexOf(id) !== -1,
      "Vorlage " + id + " kommt in der Wochenrotation nicht vor — sie wuerde nie getestet");
  });
  weekly.ROTATION.forEach(function (id) {
    assert.ok(timeline.HOOK_IDS.indexOf(id) !== -1,
      "die Rotation kennt die nicht existierende Vorlage " + id);
  });

  /* Ueber fuenf aufeinanderfolgende Wochen kommt jede Vorlage genau einmal. */
  const gesehen = new Set();
  for (let i = 0; i < weekly.ROTATION.length; i += 1) {
    gesehen.add(weekly.ROTATION[(40 + i) % weekly.ROTATION.length]);
  }
  assert.equal(gesehen.size, weekly.ROTATION.length,
    "die Rotation wiederholt sich vor der Rundrunde");
}

/* 2 — Die ISO-Woche ist die Grundlage der Determinismus-Zusage. */
function testIsoWeek() {
  /* Bekannte Faelle: der 4. Januar gehoert inKW1, nicht KW2. */
  assert.equal(weekly.isoWeek(new Date(Date.UTC(2026, 0, 4))), 1, "4.1.2026 ist nicht KW1");
  assert.equal(weekly.isoWeek(new Date(Date.UTC(2026, 0, 1))), 1, "1.1.2026 gehoert zu KW1 2026");
  /* Letzter Tag einer Woche und erster Tag der naechsten. */
  assert.equal(weekly.isoWeek(new Date(Date.UTC(2026, 9, 4))), 40, "4.10.2026 ist nicht KW40");
  assert.equal(weekly.isoWeek(new Date(Date.UTC(2026, 9, 5))), 41, "5.10.2026 ist nicht KW41");
  /* Sonntag gehoert in dieselbe Woche wie der Montag davor (ISO-Regel). */
  assert.equal(weekly.isoWeek(new Date(Date.UTC(2026, 9, 4))),
    weekly.isoWeek(new Date(Date.UTC(2026, 8, 28))), "Sonntag und Montag liegen in verschiedenen Wochen");

  /* Jede Kalenderwoche liefert dieselbe Hook-Woche — sonst waere der Seed
     zweier Laeufe in derselben Woche verschieden. */
  const montag = weekly.isoWeek(new Date(Date.UTC(2026, 9, 5)));
  const freitag = weekly.isoWeek(new Date(Date.UTC(2026, 9, 9)));
  assert.equal(montag, freitag, "Montag und Freitag derselben Woche ergeben verschiedene Wochen");
}

/* 3 — Optionen: gueltige werden akzeptiert, ungueltige sind klare Fehler.
 *
 * Die Fehlerfaelle laufen ueber einen echten Prozessaufruf, nicht direkt:
 * parseArgs() bricht mit process.exit(1) ab, und das laesst sich mit
 * try/catch nicht fangen. Genau das soll hier aber geprueft werden — dass
 * ein Tippfehler im Aufruf nicht stillschweigend zu einem anderen Lauf
 * fuehrt, sondern abbricht. */
function testArgumente() {
  const o = weekly.parseArgs(["--hook", "streak", "--index", "2", "--port", "9000", "--keine-mail", "--dry-run"]);
  assert.equal(o.hook, "streak");
  assert.equal(o.index, 2);
  assert.equal(o.port, 9000);
  assert.equal(o.mail, false);
  assert.equal(o.dryRun, true);

  /* Vorgaben muessen stimmen, sonst postet der Lauf ungefragt auf KW1. */
  const v = weekly.parseArgs([]);
  assert.equal(v.mail, true);
  assert.equal(v.dryRun, false);
  assert.equal(v.index, 0);
  assert.equal(v.count, 3);

  const cli = path.join(PIPELINE, "weekly.js");
  [["--index", "-1"], ["--index", "x"], ["--count", "1"], ["--count", "9"],
   ["--port", "80"], ["--port", "abc"], ["--gibtsnicht"]].forEach(function (paar) {
    const r = childProcess.spawnSync(process.execPath, [cli].concat(paar), { encoding: "utf8" });
    assert.notEqual(r.status, 0, "wurde still akzeptiert: " + paar.join(" "));
    assert.ok(/FEHLER/.test(r.stderr), "keine klare Fehlermeldung bei: " + paar.join(" "));
  });

  /* Und ein gueltiger Aufruf darf nicht abbrechen. */
  const ok = childProcess.spawnSync(process.execPath, [cli, "--dry-run"], { encoding: "utf8" });
  assert.equal(ok.status, 0, "--dry-run bricht ab: " + ok.stderr);
  assert.ok(/dry-run/.test(ok.stdout), "--dry-run sagt nicht, dass es nichts tut");
  assert.ok(!/Frames|QUEUE_OK/.test(ok.stdout), "--dry-run hat doch gerendert");
}

/* 4 — Der Mail-Schluessel darf niemals im Repo landen. */
function testKeinSchluesselImRepo() {
  const gitignore = fs.readFileSync(path.join(PIPELINE, "..", ".gitignore"), "utf8");
  assert.ok(/\.mail-key/.test(gitignore), ".mail-key steht nicht in .gitignore");
  const pkg = JSON.parse(fs.readFileSync(path.join(PIPELINE, "package.json"), "utf8"));
  assert.ok(pkg.scripts.woche, "npm run woche fehlt");
  assert.ok(pkg.scripts["woche:dry"], "npm run woche:dry fehlt");
}

/* 5 — Das Runbook nennt den Befehl, den die Doku behauptet. */
function testRunbookPasst() {
  const runbook = path.join(PIPELINE, "WOCHENRUNBOOK.md");
  assert.ok(fs.existsSync(runbook), "WOCHENRUNBOOK.md fehlt");
  const text = fs.readFileSync(runbook, "utf8");
  assert.ok(text.indexOf("npm run woche") !== -1, "das Runbook nennt npm run woche nicht");
  assert.ok(fs.existsSync(path.join(PIPELINE, "MESSPROTOKOLL.md")),
    "MESSPROTOKOLL.md fehlt — ohne Ablage ist die 24-h-Abnahme nicht erfuellbar");
  /* Die Rotation im Buch muss mit der im Code uebereinstimmen, sonst
   * postet man planlos. */
  weekly.ROTATION.forEach(function (id) {
    assert.ok(text.indexOf(id) !== -1, "das Runbook erwaehnt die Vorlage " + id + " nicht");
  });
}

const tests = [
  testRotation,
  testIsoWeek,
  testArgumente,
  testKeinSchluesselImRepo,
  testRunbookPasst
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
process.stdout.write("WEEKLY_OK (" + tests.length + " Tests)\n");