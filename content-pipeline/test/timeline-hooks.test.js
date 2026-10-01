#!/usr/bin/env node
"use strict";


// @block pipeline — Orchestrierung und Timeline
// Blockzuordnung: siehe test/runs.js (node test/runs.js --bloecke)
/*
 * P7.4.1–7.4.3 — Hook-Vorlagen und Countdown.
 * Reine Mathematik, kein Browser: geprüft werden Auswahl, Bytegleichheit des
 * Standards, Planungsgrenzen und das exakte Verhalten des Countdown-Timers.
 */

const assert = require("node:assert/strict");
const timeline = require("../lib/timeline");

function byId(plan, id) {
  const segment = plan.segments.find(function (entry) { return entry.id === id; });
  assert.ok(segment, "Segment " + id + " fehlt");
  return segment;
}

/* 1 — Alle fuenf Vorlagen existieren und bleiben im Zeitfenster. */
function testAllHooks() {
  const expected = ["frage", "countdown", "erwachsenen", "streak", "vorher-nachher"];
  assert.deepEqual(timeline.HOOK_IDS.slice().sort(), expected.slice().sort(),
    "die vier Format-Hooks plus der Standard fehlen");
  assert.equal(timeline.DEFAULT_HOOK, "frage");

  timeline.HOOK_IDS.forEach(function (id) {
    const plan = timeline.buildTimeline(30, id);
    assert.ok(plan.totalSeconds >= 15 && plan.totalSeconds <= 25,
      id + " liegt mit " + plan.totalSeconds + " s ausserhalb 15-25 s");
    assert.equal(plan.hook, id, "Vorlage nicht in der Zeitachse vermerkt");
    assert.equal(plan.segments[plan.segments.length - 1].id, "endcard",
      id + " endet nicht mit der Endcard");

    /* Der Retention-Kern gilt in jeder Vorlage. */
    const pause = byId(plan, "pause");
    const solution = byId(plan, "solution");
    assert.equal(pause.toFrame + 1, solution.fromFrame,
      id + ": Aufloesung folgt nicht direkt auf die Denkpause");
    const endcard = byId(plan, "endcard");
    assert.equal(solution.toFrame + 1, endcard.fromFrame, id + ": Endcard folgt nicht auf die Loesung");
    assert.ok(endcard.seconds >= 2 && endcard.seconds <= 3,
      id + ": Endcard muss 2-3 s dauern");

    /* Die Denkpause bleibt eine Pause: nichts wird vorher aufgeloest. */
    const states = timeline.allFrameStates(plan);
    states.slice(pause.fromFrame, pause.toFrame + 1).forEach(function (state) {
      assert.equal(state.solutionVisible, false,
        id + ": Loesung erscheint in der Denkpause (Frame " + state.frame + ")");
      assert.equal(state.revealProgress, 1, id + ": Zeichnung in der Pause nicht fertig");
    });
  });
}

/* 2 — Der Standardlauf bleibt bytegleich. Das ist die entscheidende Abnahme. */
function testDefaultStaysIdentical() {
  const legacyKeys = [
    "width", "height", "fps", "segments", "solutionFadeSeconds", "endcardFadeSeconds",
    "brandName", "brandUrl", "brandClaim", "totalSeconds", "totalMs", "totalFrames"
  ];
  const alt = timeline.buildTimeline(30);
  const explicit = timeline.buildTimeline(30, "frage");
  legacyKeys.forEach(function (key) {
    assert.deepEqual(explicit[key], alt[key], "Feld " + key + " hat sich gegenueber 7.3 geaendert");
  });
  /* Auch die Framezustaende muessen unveraendert sein. */
  const oldShape = function (plan) {
    return timeline.allFrameStates(plan).map(function (s) {
      return [s.frame, s.segment, s.revealProgress, s.solutionProgress, s.endcardProgress];
    });
  };
  assert.deepEqual(oldShape(explicit), oldShape(alt),
    "Framezustaende des Standardlaufs haben sich geaendert");

  /* Und die Vorlage ohne Zeitachse verhaelt sich wie der alte Aufruf. */
  assert.deepEqual(timeline.buildTimeline(), alt, "buildTimeline() ohne Hook weicht ab");
}

/* 3 — P7.4.2 Countdown: sichtbar, absteigend, nie 0, synchron zur Pause. */
function testCountdown() {
  const plan = timeline.buildTimeline(30, "countdown");
  const pause = byId(plan, "pause");
  const states = timeline.allFrameStates(plan);

  assert.equal(plan.pauseMode, "countdown");
  assert.equal(plan.countdownSeconds, 5);
  assert.equal(pause.frameCount, 150, "Countdown-Pause muss 5 s dauern");
  assert.equal(plan.pauseText, null, "Countdown hat keinen Hinweistext als Ersatz");

  /*
   * Die Zahl im Hook-Text muss die Zahl sein, die sichtbar heruntergezaehlt
   * wird. Ein Hook, der "10 Sekunden" verspricht, waehrend "3" erscheint, ist
   * der haeufigste Fehler in solchen Clips — deshalb wird er hier festgenagelt.
   */
  const promised = Number((plan.hookLine.match(/(\d+)\s*Sekunden/) || [])[1]);
  assert.ok(Number.isInteger(promised), "Countdown-Hook nennt keine Sekundenzahl: " + plan.hookLine);
  assert.equal(promised, plan.countdownSeconds,
    "Hook verspricht " + promised + " s, der Timer zaehlt " + plan.countdownSeconds + " s");
  assert.equal(promised, plan.pauseSeconds, "Versprochene Zeit passt nicht zur Pausendauer");

  /* Erster Frame zeigt den vollen Wert, letzter zeigt 1. */
  assert.equal(states[pause.fromFrame].countdownValue, 5, "Countdown startet nicht bei 5");
  assert.equal(states[pause.toFrame].countdownValue, 1, "Countdown endet nicht bei 1");

  /* Ausserhalb der Pause ist nichts zu sehen. */
  assert.equal(states[pause.fromFrame - 1].countdownVisible, false, "Countdown vor der Pause sichtbar");
  assert.equal(states[pause.toFrame + 1].countdownVisible, false, "Countdown nach der Pause sichtbar");

  /* Der Wert faellt monoton und ueberspringt nie. */
  let previous = Infinity;
  const values = [];
  for (let frame = pause.fromFrame; frame <= pause.toFrame; frame += 1) {
    const state = states[frame];
    assert.ok(state.countdownVisible, "Countdown in der Pause nicht sichtbar");
    assert.ok(state.countdownValue <= previous, "Countdown springt hoch bei Frame " + frame);
    assert.ok(state.countdownValue >= 1, "Countdown zeigt 0 oder weniger bei Frame " + frame);
    previous = state.countdownValue;
    if (values[values.length - 1] !== state.countdownValue) values.push(state.countdownValue);
  }
  assert.deepEqual(values, [5, 4, 3, 2, 1], "Countdown zaehlt nicht 5-4-3-2-1 herunter");

  /* Der Fortschritt laeuft von 0 auf 1 und ist am Ende vollstaendig. */
  assert.ok(states[pause.fromFrame].countdownProgress > 0, "Balken startet bei 0");
  assert.equal(states[pause.toFrame].countdownProgress, 1, "Balken ist am Ende nicht voll");
  let lastProgress = -1;
  states.slice(pause.fromFrame, pause.toFrame + 1).forEach(function (state) {
    assert.ok(state.countdownProgress >= lastProgress, "Balken laeuft rueckwaerts");
    lastProgress = state.countdownProgress;
  });

  /* Die Aufloesung folgt unmittelbar, ohne dass ein 0er-Frame dazwischenliegt. */
  const solution = byId(plan, "solution");
  assert.equal(states[solution.fromFrame].countdownVisible, false,
    "Countdown laeuft noch in der Aufloesung weiter");

  /* Kein Countdown in den uebrigen Vorlagen. */
  ["frage", "erwachsenen", "streak", "vorher-nachher"].forEach(function (id) {
    const other = timeline.buildTimeline(30, id);
    assert.equal(other.pauseMode, "hint", id + " darf keinen Countdown-Modus haben");
    assert.equal(other.countdownSeconds, 0);
    timeline.allFrameStates(other).forEach(function (state) {
      assert.equal(state.countdownVisible, false, id + " zeigt einen Countdown");
    });
  });
}

/* 4 — P7.4.3 — Die Hooks bringen Text mit, der Standard keinen. */
function testHookText() {
  assert.equal(timeline.buildTimeline(30, "frage").hookLine, null,
    "der Standard darf keine zusaetzliche Hook-Zeile bekommen");

  ["countdown", "erwachsenen", "streak", "vorher-nachher"].forEach(function (id) {
    const plan = timeline.buildTimeline(30, id);
    assert.ok(plan.hookLine && plan.hookLine.length > 3, id + " hat keine Hook-Zeile");
    assert.ok(plan.eyebrow && plan.eyebrow.length > 0, id + " hat keine Eyebrow");
    assert.ok(plan.hookLabel.length > 0, id + " hat kein lesbares Label");
  });

  /* Die Vorher/Nachher-Vorlage ist die einzige mit zusaetzlichem Segment. */
  const plain = timeline.buildTimeline(30, "frage").segments.map(function (s) { return s.id; });
  const compare = timeline.buildTimeline(30, "vorher-nachher").segments.map(function (s) { return s.id; });
  assert.deepEqual(plain, ["hook", "reveal", "pause", "solution", "endcard"]);
  assert.deepEqual(compare, ["hook", "vorher", "reveal", "pause", "solution", "endcard"],
    "Vorher/Nachher hat kein zusaetzliches Vergleichssegment");
  const vplan = timeline.buildTimeline(30, "vorher-nachher");
  assert.ok(byId(vplan, "vorher").toFrame < byId(vplan, "reveal").fromFrame,
    "der Schulweg muss vor dem Blueprint liegen");

  /* Der Streak-Hook nutzt keine echten Nutzerdaten. */
  const streak = timeline.buildTimeline(30, "streak");
  assert.ok(streak.hookLine.length > 0);
  assert.doesNotMatch(JSON.stringify(streak), /@[a-z0-9.-]+\.[a-z]{2,}/i,
    "im Streak-Hook steckt eine E-Mail-Adresse");
  assert.doesNotMatch(streak.hookLine, /\d{3,}/, "die Hook-Zahl ist unplausibel konkret");
}

/* 5 — Unbekannte Vorlagen scheitern klar, statt still zu ersetzen. */
function testInvalidHooks() {
  ["gibtsnicht", "FRAGE", "Countdown", 42].forEach(function (value) {
    assert.throws(function () { timeline.hookById(value); }, /Hook-Vorlage/,
      "Vorlage " + JSON.stringify(value) + " wurde still akzeptiert");
  });
  /* buildTimeline mit unbekannter Vorlage muss ebenso scheitern. */
  assert.throws(function () { timeline.buildTimeline(30, "gibtsnicht"); }, /Hook-Vorlage/);
  /*
   * Leer und undefined bedeuten ausdruecklich "Standard": die Option ist
   * optional, ein Aufruf ohne --hook ist der Normalfall. (Anders als bei
   * Pfaden, wo ein leerer Wert ein Fehler ist.)
   */
  assert.equal(timeline.hookById(undefined).id, "frage");
  assert.equal(timeline.hookById(null).id, "frage");
  assert.equal(timeline.hookById("").id, "frage");
  assert.equal(timeline.buildTimeline(30, undefined).hook, "frage");
  assert.equal(timeline.buildTimeline(30, "").hook, "frage");
  /* Und "toString" darf nicht durch das Objekt-Prototyp slippen. */
  assert.throws(function () { timeline.hookById("toString"); }, /Hook-Vorlage/);
  assert.throws(function () { timeline.hookById("constructor"); }, /Hook-Vorlage/);
}

/* 6 — Determinismus: dieselbe Vorlage ergibt dieselben Frames. */
function testDeterministic() {
  timeline.HOOK_IDS.forEach(function (id) {
    assert.deepEqual(timeline.buildTimeline(30, id), timeline.buildTimeline(30, id),
      id + " ist nicht deterministisch");
    assert.deepEqual(timeline.allFrameStates(timeline.buildTimeline(30, id)),
      timeline.allFrameStates(timeline.buildTimeline(30, id)),
      id + " liefert unterschiedliche Framezustaende");
  });
  /* 7.3.3: Gleiche Eingabe ergibt bitgleiche Framezustaende. */
  assert.deepEqual(timeline.allFrameStates(timeline.buildTimeline(30)),
    timeline.allFrameStates(timeline.buildTimeline(30)));
}

const tests = [
  testAllHooks,
  testDefaultStaysIdentical,
  testCountdown,
  testHookText,
  testInvalidHooks,
  testDeterministic
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
process.stdout.write("TIMELINE_HOOKS_OK (" + tests.length + " Tests)\n");
