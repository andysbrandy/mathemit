#!/usr/bin/env node
"use strict";

/*
 * P7.3.3/7.3.5 — Zeitachse der 9:16-Bühne: reine Mathematik, kein Browser.
 * Geprüft werden feste Bühne, feste Bildrate, Segmentordnung, die
 * 2-Sekunden-Denkpause direkt vor der Auflösung und die Endcard am Ende.
 */

const assert = require("node:assert/strict");
const timeline = require("../lib/timeline");

function byId(plan, id) {
  const segment = plan.segments.find(function (entry) { return entry.id === id; });
  assert.ok(segment, "Segment " + id + " fehlt");
  return segment;
}

/* 1 — Feste Bühne, feste Bildrate, planbare Clip-Länge. */
function testFixedStage() {
  const plan = timeline.buildTimeline();
  assert.equal(plan.width, 1080);
  assert.equal(plan.height, 1920);
  assert.equal(plan.fps, 30);
  assert.equal(plan.totalFrames, 480);
  assert.equal(plan.totalMs, 16000);
  assert.equal(plan.totalSeconds, 16);
  assert.ok(plan.totalSeconds >= 15 && plan.totalSeconds <= 25, "Clip muss 15–25 s dauern");
  const counted = plan.segments.reduce(function (sum, segment) { return sum + segment.frameCount; }, 0);
  assert.equal(counted, plan.totalFrames, "Frame-Budget der Segmente passt nicht zur Gesamtlänge");
  assert.equal(plan.segments[plan.segments.length - 1].toFrame, plan.totalFrames - 1);
}

/* 2 — Feste Reihenfolge mit 2 s Denkpause unmittelbar vor der Auflösung. */
function testPauseBeforeSolution() {
  const plan = timeline.buildTimeline();
  const ids = plan.segments.map(function (segment) { return segment.id; });
  assert.deepEqual(ids, ["hook", "reveal", "pause", "solution", "endcard"]);

  const pause = byId(plan, "pause");
  const solution = byId(plan, "solution");
  assert.equal(pause.toFrame + 1, solution.fromFrame, "Auflösung muss direkt auf die Denkpause folgen");
  assert.equal(pause.toTimeMs - pause.fromTimeMs, 2000);
  assert.equal(pause.frameCount, 60);

  const states = timeline.allFrameStates(plan);
  states.forEach(function (state) {
    const expectedPause = state.frame >= pause.fromFrame && state.frame <= pause.toFrame;
    assert.equal(state.pauseActive, expectedPause, "Frame " + state.frame + " hat falsche Pausenlage");
    const expectedSolution = state.frame >= solution.fromFrame;
    assert.equal(state.solutionVisible, expectedSolution, "Frame " + state.frame + " blendet die Auflösung falsch ein");
  });

  /* Während der Pause ist die Zeichnung vollständig, aber noch ohne Lösung. */
  const inPause = states[pause.fromFrame];
  assert.equal(inPause.revealProgress, 1);
  assert.equal(inPause.solutionProgress, 0);
  assert.equal(states[pause.fromFrame - 1].pauseActive, false);
  assert.equal(states[solution.fromFrame].pauseActive, false);
}

/* 3 — Reveal läuft monoton von 0 auf 1 und ruckelt nicht. */
function testRevealProgress() {
  const plan = timeline.buildTimeline();
  const reveal = byId(plan, "reveal");
  const pause = byId(plan, "pause");
  const states = timeline.allFrameStates(plan);
  assert.equal(states[reveal.fromFrame - 1].revealProgress, 0, "Vor dem Reveal ist nichts gezeichnet");
  assert.ok(states[reveal.toFrame].revealProgress > 0.999, "Am Reveal-Ende ist fast alles gezeichnet");
  assert.equal(states[pause.fromFrame].revealProgress, 1, "In der Denkpause ist alles gezeichnet");
  states.slice(pause.fromFrame).forEach(function (state) {
    assert.equal(state.revealProgress, 1, "Die Zeichnung bleibt abgeschlossen (Frame " + state.frame + ")");
  });

  let previous = -1;
  states.forEach(function (state) {
    assert.ok(state.revealProgress >= previous, "Reveal muss monoton wachsen (Frame " + state.frame + ")");
    assert.ok(state.revealProgress >= 0 && state.revealProgress <= 1, "Reveal-Wert außerhalb 0–1");
    previous = state.revealProgress;
  });

  const solution = byId(plan, "solution");
  const fadeFrames = Math.round(plan.solutionFadeSeconds * plan.fps);
  assert.ok(timeline.easeOutCubic(1 / fadeFrames) > 0, "Auflösung muss sofort sichtbar werden");
  assert.equal(timeline.easeOutCubic(1), 1);
  assert.equal(states[solution.fromFrame + fadeFrames].solutionProgress, 1);
  assert.ok(states[solution.fromFrame].solutionProgress < 1, "Auflösung blendet weich ein");
}

/* 4 — Endcard: 3 s am Ende, weiches Einblenden, Marke bleibt sichtbar. */
function testEndcard() {
  const plan = timeline.buildTimeline();
  const endcard = byId(plan, "endcard");
  const solution = byId(plan, "solution");
  const states = timeline.allFrameStates(plan);

  assert.equal(endcard.toFrame + 1, plan.totalFrames, "Endcard muss den Clip abschließen");
  assert.equal(endcard.toTimeMs - endcard.fromTimeMs, 3000);
  assert.ok(endcard.seconds >= 2 && endcard.seconds <= 3, "Endcard muss 2–3 s dauern");
  assert.equal(solution.toFrame + 1, endcard.fromFrame, "Endcard folgt direkt auf die Lösung");

  states.forEach(function (state) {
    const expected = state.frame >= endcard.fromFrame;
    assert.equal(state.endcardVisible, expected, "Frame " + state.frame + " blendet die Endcard falsch ein");
  });
  assert.equal(states[endcard.fromFrame - 1].endcardProgress, 0, "Vor der Endcard ist nichts zu sehen");
  assert.equal(states[endcard.fromFrame].endcardVisible, true, "Endcard startet sofort sichtbar");
  assert.equal(states[plan.totalFrames - 1].endcardProgress, 1, "Am Clip-Ende ist die Endcard voll da");

  const fadeFrames = Math.round(plan.endcardFadeSeconds * plan.fps);
  assert.ok(states[endcard.fromFrame].endcardProgress < 1, "Endcard blendet weich ein");
  assert.equal(states[endcard.fromFrame + fadeFrames].endcardProgress, 1);

  /* Die Marke kommt aus der Zeitachse, damit Text und Clip nicht auseinanderlaufen. */
  assert.equal(plan.brandName, "Mathemit");
  assert.equal(plan.brandUrl, "https://mathemit.andybrandy.at/");
  assert.ok(plan.brandClaim.length > 0, "Endcard braucht eine Zeile als Textanker");
  assert.equal(plan.brandUrl, timeline.BRAND_URL);
  assert.equal(plan.brandName, timeline.BRAND_NAME);

  /* Während der Endcard bleiben Zeichnung und Lösung stehen — nichts springt zurück. */
  states.slice(endcard.fromFrame).forEach(function (state) {
    assert.equal(state.revealProgress, 1, "Reveal bleibt vollständig sichtbar (Frame " + state.frame + ")");
    assert.equal(state.solutionProgress, 1, "Lösung bleibt sichtbar (Frame " + state.frame + ")");
    assert.equal(state.pauseActive, false, "In der Endcard läuft keine Denkpause (Frame " + state.frame + ")");
  });
}

/* 5 — Gleiche Eingabe ergibt bitgleiche Framezustände. */
function testDeterministicStates() {
  assert.deepEqual(timeline.allFrameStates(timeline.buildTimeline(30)),
    timeline.allFrameStates(timeline.buildTimeline(30)));
  assert.deepEqual(timeline.buildTimeline(30), timeline.buildTimeline(30));
}

/* 6 — Ungültige Bildraten und Frame-Indizes müssen klar scheitern. */
function testInvalidInput() {
  [0, -1, 61, 12.5, "30"].forEach(function (value) {
    assert.throws(function () { timeline.buildTimeline(value); }, /Bildrate/);
  });
  const plan = timeline.buildTimeline();
  [-1, plan.totalFrames, 1.5].forEach(function (frame) {
    assert.throws(function () { timeline.frameState(plan, frame); }, /außerhalb der Zeitachse/);
  });
  assert.throws(function () { timeline.frameState(null, 0); }, /unterstütztes Format/);
}

const tests = [
  testFixedStage,
  testPauseBeforeSolution,
  testRevealProgress,
  testEndcard,
  testDeterministicStates,
  testInvalidInput
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
process.stdout.write("TIMELINE_OK (" + tests.length + " Tests)\n");
