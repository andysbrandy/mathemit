const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PIPELINE = path.resolve(__dirname, "..");
const RUN = path.join(PIPELINE, "run-pipeline.js");
const runner = require("../lib/ffmpeg-runner");
const pipeline = require("../run-pipeline");

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
].find(function (candidate) { return candidate && fs.existsSync(candidate); });
const TOOLCHAIN = Boolean(runner.findFfmpeg() && CHROME);

function run(args) {
  return childProcess.spawnSync(process.execPath, [RUN].concat(args), {
    cwd: path.resolve(PIPELINE, ".."),
    encoding: "utf8"
  });
}

/* 1 — Optionen werden geprüft, nicht durchgewunken. */
function testArgumentHandling() {
  assert.equal(pipeline.parseArgs([]).seed, "p7-3", "Vorgabe-Seed fehlt");
  assert.equal(pipeline.parseArgs(["--seed", "x", "--index", "2"]).index, 2);
  assert.equal(pipeline.parseArgs(["--seed", "x", "--index", "2"]).index, 2,
    "Index muss eine Zahl sein, kein Text");
  assert.equal(pipeline.parseArgs(["--count", "5"]).count, 5);
  assert.equal(pipeline.parseArgs(["--difficulty", "1"]).difficulty, 1);
  assert.equal(pipeline.parseArgs(["--reuse-frames"]).reuseFrames, true);

  /* Zahlen und Wertebereiche werden abgewiesen, nicht stillschweigend repariert.
     Das Skript beendet den Prozess statt zu werfen, also ueber echte Laeufe pruefen. */
  const cases = [
    { args: ["--index", "abc"], message: /ganze Zahl/ },
    { args: ["--count", "-1"], message: /ganze Zahl/ },
    { args: ["--difficulty", "9"], message: /0, 1 oder 2/ },
    { args: ["--index"], message: /fehlt ein Wert/ },
    { args: ["--seed", "  "], message: /Seed darf nicht leer/ }
  ];
  cases.forEach(function (testCase) {
    const result = run(testCase.args);
    assert.notEqual(result.status, 0, testCase.args.join(" ") + " muss scheitern");
    assert.match(result.stderr, testCase.message, testCase.args.join(" "));
  });

  const unknown = run(["--gibtsnicht"]);
  assert.notEqual(unknown.status, 0, "Unbekannte Option muss scheitern");
  assert.match(unknown.stderr, /Unbekannte Option/);

  const help = run(["--help"]);
  assert.equal(help.status, 0, "--help muss sauber enden");
  assert.match(help.stdout, /Verwendung/);
}

/* 2 — Ein fremder oder unvollständiger Framesatz darf nicht montiert werden. */
function testRefusesBadFrameSet() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p735-"));
  try {
    const framesDir = path.join(workDir, "frames");
    fs.mkdirSync(framesDir);

    /* Kein manifest.json und kein halb geschriebenes: beides wird als null
       gemeldet, damit die Kette hier endet. Die Meldungen werden
       mitgeprueft, statt sie nur zu ueberhoeren. */
    const manifest = path.join(framesDir, "manifest.json");
    const said = [];
    const warn = function (message) { said.push(message); };
    assert.equal(pipeline.readJson(manifest, "Frame-Manifest", warn), null,
      "fehlendes Manifest wird als null gemeldet");
    assert.equal(said.length, 1);
    assert.match(said[0], /^Frame-Manifest fehlt: /);

    fs.writeFileSync(manifest, "{ abgeschnitten");
    said.length = 0;
    assert.equal(pipeline.readJson(manifest, "Frame-Manifest", warn), null,
      "kaputtes Manifest wird als null gemeldet");
    assert.equal(said.length, 1);
    assert.match(said[0], /^Frame-Manifest ist unlesbar: /);

    /* Ein gueltiges Manifest liefert genau die erwartete Struktur. */
    const frames = { complete: true, frameSetSha256: "b".repeat(64) };
    fs.writeFileSync(manifest, JSON.stringify(frames));
    said.length = 0;
    const read = pipeline.readJson(manifest, "Frame-Manifest", warn);
    assert.equal(read.complete, true);
    assert.equal(read.frameSetSha256, frames.frameSetSha256);
    assert.equal(said.length, 0, "ein gueltiges Manifest bleibt still");

    /* Und die Montage-Vorbedingungen gelten fuer genau diesen Satz. */
    const good = {
      schemaVersion: 1,
      complete: true,
      totalFrames: 480,
      renderedFrames: 480,
      frames: new Array(480).fill({ frame: 0 })
    };
    assert.equal(pipeline.assertFrameSource(good), good,
      "ein vollstaendiger Satz wird unveraendert zurueckgegeben");

    /* Ohne Manifest, mit halbem Schema, mit unvollstaendigem Satz: immer Abbruch. */
    const cases = [
      { manifest: null, message: /Ohne Frame-Manifest/ },
      { manifest: { complete: true }, message: /schemaVersion 1/ },
      { manifest: { schemaVersion: 1, complete: false, renderedFrames: 12, totalFrames: 480 },
        message: /unvollständig/ },
      { manifest: { schemaVersion: 1, complete: true, totalFrames: 480, renderedFrames: 480, frames: [] },
        message: /zählt 0 Frames/ }
    ];
    cases.forEach(function (testCase) {
      assert.throws(function () { pipeline.assertFrameSource(testCase.manifest); },
        testCase.message, JSON.stringify(testCase.manifest));
    });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
/* 3 — Echter End-to-End-Lauf: vier Stufen, ein Clip, eine Hash-Kette. */
function testEndToEnd() {
  if (!TOOLCHAIN) {
    process.stdout.write("SKIP testEndToEnd (kein ffmpeg/Chrome gefunden)\n");
    return;
  }
  try {
    process.stdout.write("  (End-to-End-Lauf, ca. 60 s)\n");
    /* Kleinste von select-exercises.js erlaubte Episode: 3 Aufgaben. */
    const result = run(["--seed", "p7-3-5", "--count", "3"]);
    assert.equal(result.status, 0, "Der Lauf muss durchlaufen: " + result.stderr);
    assert.match(result.stdout, /PIPELINE_OK/, "Lauf meldet keinen Erfolg");
    assert.match(result.stdout, /CLIP_CHECK_OK/, "Gegenprobe hat nicht bestaetigt");
    assert.match(result.stdout, /=== 4\/4 Gegenprobe ===/, "die vierte Stufe lief nicht");

    /* Der Bericht liegt im Arbeitsordner, nicht im Temp-Verzeichnis. */
    const stored = path.join(PIPELINE, "work", "pipeline-report.json");
    assert.ok(fs.existsSync(stored), "Bericht fehlt");
    const report = JSON.parse(fs.readFileSync(stored, "utf8"));
    assert.equal(report.seed, "p7-3-5");
    assert.equal(report.stage.width, 1080);
    assert.equal(report.stage.height, 1920);
    assert.equal(report.codecs.video, "h264");
    assert.equal(report.codecs.audio, false, "der Clip darf stumm sein");
    assert.equal(report.frameCount, 480);
    assert.equal(report.verified, true);
    assert.ok(report.clipBytes > 100000, "Clip ist verdächtig klein");
    assert.deepEqual(report.measuredSegments, ["endcard", "hook", "pause", "reveal", "solution"],
      "nicht jedes Segment wurde am Bild geprueft");

    /* Hash-Kette: Auswahl → Frames → Clip. */
    const clipManifest = JSON.parse(fs.readFileSync(
      path.join(PIPELINE, "work", "video", "clip-manifest.json"), "utf8"));
    const frameManifest = JSON.parse(fs.readFileSync(
      path.join(PIPELINE, "work", "frames", "manifest.json"), "utf8"));
    assert.equal(clipManifest.sourceFrameSetSha256, report.frameSetSha256);
    assert.equal(report.frameSetSha256, frameManifest.frameSetSha256);
    assert.ok(fs.existsSync(path.join(PIPELINE, "work", "video", "clip.mp4")), "Clip fehlt");
  } catch (error) {
    process.stdout.write("FAIL End-to-End: " + error.message + "\n");
    process.exit(1);
  }
}

/* 4 — Gleicher Seed, gleicher Clip: der ganze Lauf ist wiederholbar. */
function testDeterministicReuse() {
  if (!TOOLCHAIN) {
    process.stdout.write("SKIP testDeterministicReuse (kein ffmpeg/Chrome gefunden)\n");
    return;
  }
  const reportPath = path.join(PIPELINE, "work", "pipeline-report.json");
  const before = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  /* Der zweite Lauf muss die bereits geprueften Frames wiederverwenden. */
  const reused = run(["--seed", "p7-3-5", "--count", "3", "--reuse-frames"]);
  assert.equal(reused.status, 0, "Wiederholung muss durchlaufen: " + reused.stderr);
  const after = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(after.frameSetSha256, before.frameSetSha256, "Frames sind nicht reproduzierbar");
  assert.equal(after.clipSha256, before.clipSha256, "Clip ist nicht reproduzierbar");
  assert.equal(after.verified, true);
  assert.match(reused.stdout, /Frames \(wiederverwendet\)/, "Wiederverwendung wurde nicht gemeldet");
}

const tests = [
  testArgumentHandling,
  testRefusesBadFrameSet,
  testEndToEnd,
  testDeterministicReuse
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
process.stdout.write("RUN_PIPELINE_OK (" + tests.length + " Tests)\n");
