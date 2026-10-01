
// @block video — Video-Assembling und Clip-Pruefung
// Blockzuordnung: siehe test/runs.js (node test/runs.js --bloecke)
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PIPELINE = path.resolve(__dirname, "..");
const VERIFY = path.join(PIPELINE, "verify-clip.js");
const runner = require("../lib/ffmpeg-runner");
const timeline = require("../lib/timeline");
const verify = require("../verify-clip");

const FFMPEG = runner.findFfmpeg();

/* 1 — Die Stichproben decken jedes Segment und den letzten Frame ab. */
function testSampleSelection() {
  const plan = timeline.buildTimeline();
  const frames = verify.sampleFrames(plan, 30);
  assert.ok(frames.length >= 12, "zu wenige Stichproben");
  assert.deepEqual(frames, frames.slice().sort(function (a, b) { return a - b; }), "Stichproben müssen sortiert sein");
  assert.equal(frames[0], 0, "Hook-Anfang fehlt");
  assert.equal(frames[frames.length - 1], plan.totalFrames - 1, "letzter Frame fehlt");

  const segments = new Set(frames.map(function (frame) { return timeline.frameState(plan, frame).segment; }));
  assert.deepEqual(Array.from(segments).sort(), ["endcard", "hook", "pause", "reveal", "solution"],
    "jedes Segment braucht mindestens eine Stichprobe");
  const pauseStart = plan.segments[2].fromFrame;
  const solutionStart = plan.segments[3].fromFrame;
  assert.ok(frames.includes(pauseStart) && frames.includes(solutionStart),
    "Denkpause und Auflösung müssen beide gemessen werden");
}

/* 2 — Segment-Erwartungen: Lösung erst ab der Auflösung, Endcard nur am Ende. */
function testSegmentRules() {
  assert.equal(verify.SEGMENT_RULES.solution.solutionVisible, true);
  assert.equal(verify.SEGMENT_RULES.pause.solutionVisible, false, "in der Denkpause ist die Lösung noch nicht da");
  assert.equal(verify.SEGMENT_RULES.endcard.endcardVisible, true);
  assert.equal(verify.SEGMENT_RULES.solution.endcardVisible, false, "Endcard erst nach der Lösung");

  const plan = timeline.buildTimeline();
  plan.segments.forEach(function (segment) {
    const state = timeline.frameState(plan, segment.fromFrame);
    const rule = verify.SEGMENT_RULES[segment.id];
    assert.ok(rule, "Segment ohne Erwartung: " + segment.id);
    assert.equal(state.solutionVisible, rule.solutionVisible,
      segment.id + ": Lösungs-Erwartung widerspricht der Zeitachse");
  });
  const last = timeline.frameState(plan, plan.totalFrames - 1);
  assert.equal(last.endcardVisible, true, "der Clip muss mit sichtbarer Endcard enden");
  assert.equal(last.segment, "endcard");
}

/* 3 — Ein gleichmäßig schwarzes Bild wird als Fehler erkannt, die Endcard nicht. */
function testFrameJudgement() {
  const plan = timeline.buildTimeline();
  const bad = verify.checkFrame(plan, 0, makePng(1080, 1920, function () { return [0, 0, 0]; }));
  assert.ok(bad.problems.length > 0, "komplett schwarzes Bild muss auffallen");
  assert.ok(bad.problems.join(" ").includes("schwarz"), "Problem muss als schwarz benannt werden: " + bad.problems);

  const wrongSize = verify.checkFrame(plan, 0, makePng(640, 360, function () { return [253, 246, 231]; }));
  assert.ok(wrongSize.problems.join(" ").includes("640x360"), "falsche Auflösung muss auffallen");

  const clean = verify.checkFrame(plan, plan.totalFrames - 1,
    makePng(1080, 1920, function (x) { return x < 200 ? [253, 246, 231] : [40, 44, 52]; }));
  assert.deepEqual(clean.problems, [], "Endcard darf nicht als Fehler gelten: " + clean.problems);
}

/*
 * 5 — 7.3.5 im Kern: der gemessene Buehnenzustand muss zur Segmentregel
 * passen, und der Clip-Frame muss das gerenderte Quellbild zeigen. Beides
 * ist der Grund, warum ueberhaupt gegen die PNGs verglichen wird.
 */
function testSourceComparison() {
  const plan = timeline.buildTimeline();
  const cream = function () { return [253, 246, 231]; };
  const last = plan.totalFrames - 1;

  /* Identische Bilder duerfen keine Abweichung erzeugen. */
  const same = verify.checkFrame(plan, last, makePng(1080, 1920, cream),
    { solutionVisible: true, endcardVisible: true }, makePng(1080, 1920, cream));
  assert.equal(same.difference, 0, "identische Bilder muessen delta=0 ergeben");
  assert.deepEqual(same.problems, [], "identische Bilder duerfen kein Problem melden");

  /* Ein voellig anderes Bild muss auffallen. */
  const swapped = verify.checkFrame(plan, last, makePng(1080, 1920, function () { return [10, 20, 90]; }),
    { solutionVisible: true, endcardVisible: true }, makePng(1080, 1920, cream));
  assert.ok(swapped.difference > 100, "falsches Bild muss deutlich abweichen, war " + swapped.difference);
  assert.ok(swapped.problems.join(" ").includes("weicht"), "Abweichung muss als Problem gelten: " + swapped.problems);

  /* Falsche Aufloesung des Quellbilds: Vergleich entfaellt, kein Absturz. */
  const mismatched = verify.checkFrame(plan, last, makePng(1080, 1920, cream),
    { solutionVisible: true, endcardVisible: true }, makePng(640, 360, cream));
  assert.equal(mismatched.difference, null, "unpassende Quellgroesse entfaellt den Vergleich");

  /* Der gemessene Buehnenzustand wird gegen die Segmentregel geprueft. */
  const wrongState = verify.checkFrame(plan, 0, makePng(1080, 1920, cream),
    { solutionVisible: true, endcardVisible: false }, null);
  assert.ok(wrongState.problems.join(" ").includes("Aufloesung ist sichtbar=true"),
    "falsch gemessener Zustand muss auffallen: " + wrongState.problems);

  const wrongEndcard = verify.checkFrame(plan, last, makePng(1080, 1920, cream),
    { solutionVisible: true, endcardVisible: false }, null);
  assert.ok(wrongEndcard.problems.join(" ").includes("Endcard ist sichtbar=false"),
    "fehlende Endcard muss auffallen: " + wrongEndcard.problems);

  /* Ein gemessener Hook ohne Loesung ist der Sollzustand und bleibt still. */
  const hookState = verify.checkFrame(plan, 0, makePng(1080, 1920, cream),
    { solutionVisible: false, endcardVisible: false }, null);
  assert.deepEqual(hookState.problems, [], "korrekt gemessener Hook darf nicht auffallen");
}

/* 6 — Fehlender Clip oder falsche Option scheitern sauber, ohne Stapelabbruch. */
function testFailureOutput() {
  const env = Object.assign({}, process.env, { FFMPEG_PATH: FFMPEG || "/bin/true" });
  const missing = childProcess.spawnSync(process.execPath,
    [VERIFY, "--clip", "work/gibtsnicht.mp4"], { cwd: PIPELINE, encoding: "utf8", env: env });
  assert.notEqual(missing.status, 0, "fehlender Clip muss scheitern");
  assert.match(missing.stderr, /FEHLER: Clip fehlt/);
  assert.ok(!/at Object\.|node:internal/.test(missing.stderr), "kein Stapelabbruch bei Nutzerfehlern");

  const unknown = childProcess.spawnSync(process.execPath, [VERIFY, "--gibtsnicht"],
    { cwd: PIPELINE, encoding: "utf8", env: env });
  assert.notEqual(unknown.status, 0, "unbekannte Option muss scheitern");
  assert.match(unknown.stderr, /Unbekannte Option/);

  const badValue = childProcess.spawnSync(process.execPath, [VERIFY, "--probe-every", "0"],
    { cwd: PIPELINE, encoding: "utf8", env: env });
  assert.notEqual(badValue.status, 0, "ungültiger Wert muss scheitern");
  assert.match(badValue.stderr, /Stichprobenabstand/);
}
/* 5 — Echter Lauf: Stichproben werden aus einem Clip dekodiert. */
function testRealClip() {
  if (!FFMPEG) {
    process.stdout.write("SKIP testRealClip (kein ffmpeg gefunden)\n");
    return;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p735-"));
  try {
    const clip = path.join(workDir, "clip.mp4");
    const encode = childProcess.spawnSync(FFMPEG, [
      "-v", "error", "-f", "lavfi", "-i", "color=c=0xFDF6E7:s=1080x1920:r=30:d=16",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", clip
    ], { encoding: "utf8" });
    assert.equal(encode.status, 0, encode.stderr);

    const result = childProcess.spawnSync(process.execPath, [VERIFY, "--clip", clip, "--probe-every", "120"],
      { cwd: PIPELINE, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /CLIP_CHECK_OK/);
    assert.match(result.stdout, /Endcard 3\.0 s/);
    assert.ok(fs.statSync(clip).size > 1000, "Testclip ist verdächtig klein");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/* --- minimaler PNG-Baustein für die Bildprüfungen --- */
const CRC_TABLE = (function () {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}());

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const payload = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([length, payload, crc]);
}

function makePng(width, height, colorAt) {
  const zlib = require("node:zlib");
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const color = colorAt(x, y);
      raw[rowStart + 1 + x * 3] = color[0];
      raw[rowStart + 2 + x * 3] = color[1];
      raw[rowStart + 3 + x * 3] = color[2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

const tests = [
  testSampleSelection,
  testSegmentRules,
  testFrameJudgement,
  testSourceComparison,
  testFailureOutput,
  testRealClip
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
process.stdout.write("VERIFY_CLIP_OK (" + tests.length + " Tests)\n");
