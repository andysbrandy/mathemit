
// @block queue — Queue und Veroeffentlichung
// Blockzuordnung: siehe test/runs.js (node test/runs.js --bloecke)
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PIPELINE = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(PIPELINE, "..");
const SCRIPT = path.join(PIPELINE, "queue-episode.js");
const queue = require("../queue-episode");

const APP_URL = "https://mathemit.andybrandy.at/";

function run(args) {
  return childProcess.spawnSync(process.execPath, [SCRIPT].concat(args), {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
}

/* Baut eine vollstaendige, aber kleine Belegkette im Temp-Verzeichnis.
   Die Hashen sind bewusst gleich, damit nur die geprueften Glieder eine Rolle
   spielen. Das Frame-Manifest nennt wie im echten Lauf exerciseIndex und
   generator — davon haengt ab, welche Aufgabe die Caption beschreibt. */
function makeChain(dir, tweak) {
  const episode = {
    schemaVersion: 1,
    generatorSource: "app-base.js",
    seed: "test-seed",
    seedUint32: 12345,
    difficulty: 2,
    exercises: [
      { generator: "GEN_TEST_A", topic: "diagramm", prompt: "Wie viel ist das?", answer: 30 },
      { generator: "GEN_TEST_B", topic: "winkel", prompt: "Wie gross ist der vierte Winkel?", answer: 44 },
      { generator: "GEN_TEST_C", topic: "bruch", prompt: "Wie viel ist 5/6 - 3/5?", answer: "7/30" }
    ]
  };
  const framesHash = "HASH-FRAMES";
  const report = {
    schemaVersion: 1,
    seed: "test-seed",
    frameSetSha256: framesHash,
    frameCount: 480,
    clipSha256: "HASH-CLIP",
    clipBytes: 1234,
    durationSeconds: 16,
    stage: { width: 1080, height: 1920 },
    codecs: { video: "h264", pixFmt: "yuv420p", audio: false },
    measuredSegments: ["hook", "endcard"],
    verified: true
  };
  const clipManifest = { sourceFrameSetSha256: framesHash };

  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  fs.mkdirSync(path.join(dir, "video"), { recursive: true });
  fs.writeFileSync(path.join(dir, "frames/manifest.json"), JSON.stringify({
    frameSetSha256: framesHash, exerciseIndex: 0, generator: "GEN_TEST_A"
  }));
  fs.writeFileSync(path.join(dir, "video/clip.mp4"), "MP4-NUTZLAST");
  fs.writeFileSync(path.join(dir, "video/clip-manifest.json"), JSON.stringify(clipManifest));
  fs.writeFileSync(path.join(dir, "episode.json"), JSON.stringify(episode));
  fs.writeFileSync(path.join(dir, "pipeline-report.json"), JSON.stringify(report));

  const given = {
    clip: path.join(dir, "video/clip.mp4"),
    frames: path.join(dir, "frames"),
    report: path.join(dir, "pipeline-report.json"),
    episode: path.join(dir, "episode.json"),
    queue: path.join(dir, "queue"),
    slug: "test-i0"
  };
  if (tweak) tweak(given);
  return given;
}

/* 1 — Optionen werden geprueft, nicht durchgewunken. */
function testArgumentHandling() {
  const help = run(["--help"]);
  assert.equal(help.status, 0, "--help muss sauber enden");
  assert.match(help.stdout, /Verwendung/);
  assert.match(help.stdout, /--release/, "der manuelle Freigabeweg muss dokumentiert sein");

  const unknown = run(["--gibtsnicht"]);
  assert.notEqual(unknown.status, 0, "Unbekannte Option muss scheitern");
  assert.match(unknown.stderr, /Unbekannte Option/);

  const missingValue = run(["--clip"]);
  assert.notEqual(missingValue.status, 0);
  assert.match(missingValue.stderr, /fehlt ein Wert/);

  const empty = run(["--clip", "   "]);
  assert.notEqual(empty.status, 0, "Leerer Clip-Pfad muss scheitern");
  assert.match(empty.stderr, /darf nicht leer/);
}

/* 2 — Eine vollstaendige Kette ergibt eine freigabefaehige Episode. */
function testCompleteEpisode() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-ok-"));
  try {
    const opts = makeChain(dir);
    const result = run([
      "--clip", opts.clip, "--frames", opts.frames, "--report", opts.report,
      "--episode", opts.episode, "--queue", opts.queue, "--slug", opts.slug
    ]);
    assert.equal(result.status, 0, "Lauf muss durchlaufen: " + result.stderr);
    assert.match(result.stdout, /QUEUE_OK/, "Lauf meldet keinen Erfolg");
    assert.doesNotMatch(result.stdout, /QUEUE_UNVOLLSTAENDIG/);

    const record = JSON.parse(fs.readFileSync(
      path.join(opts.queue, opts.slug, "episode.json"), "utf8"));
    assert.equal(record.status, "bereit");
    assert.deepEqual(record.gaps, [], "vollstaendige Kette darf keine Luecke melden");
    assert.equal(record.releasedAt, null, "eine neue Episode ist noch nicht freigegeben");
    assert.equal(record.releasedBy, null);
    assert.equal(record.artifacts.video, "clip.mp4");

    /* Das MP4 liegt in der Queue und ist byteidentisch kopiert. */
    const copied = path.join(opts.queue, opts.slug, "clip.mp4");
    assert.ok(fs.existsSync(copied), "MP4 fehlt in der Queue-Episode");
    assert.equal(fs.readFileSync(copied, "utf8"), "MP4-NUTZLAST");

    /* Abnahme: MP4, Caption, Hashtags und Manifest muessen vorhanden sein. */
    assert.ok(record.caption.length > 0, "Caption fehlt");
    assert.ok(record.hashtags.length > 0, "Hashtags fehlen");
    assert.match(record.caption, new RegExp(APP_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(queue.BASE_HASHTAGS.every(function (tag) {
      return record.hashtags.indexOf(tag) !== -1;
    }), "Grund-Hashtags fehlen");

    /* Quellen- und Seed-Daten muessen mitgefuehrt werden. */
    assert.equal(record.source.seed, "test-seed");
    assert.deepEqual(record.source.generators, ["GEN_TEST_A", "GEN_TEST_B", "GEN_TEST_C"]);
    assert.equal(record.technical.verified, true);
    assert.equal(record.technical.stage.width, 1080);
    /* Der gezeigte Aufgabenindex ist ein Beleg im Manifest, keine Vermutung. */
    assert.equal(record.source.exerciseIndex, 0);
    assert.equal(record.source.shownGenerator, "GEN_TEST_A");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* 2b — Die Caption beschreibt die Aufgabe, die im Clip steht.
   Das ist der gemeldete Fehler: im Video stand die Winkel-Aufgabe, in der
   Caption stand das Saeulendiagramm. */
function testCaptionFollowsShownExercise() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-caption-"));
  try {
    /* Das Manifest nennt die zweite Aufgabe — genau das ist der Beleg. */
    const opts = makeChain(dir, function (given) {
      fs.writeFileSync(path.join(given.frames, "manifest.json"), JSON.stringify({
        frameSetSha256: "HASH-FRAMES", exerciseIndex: 1, generator: "GEN_TEST_B"
      }));
    });
    const result = run([
      "--clip", opts.clip, "--frames", opts.frames, "--report", opts.report,
      "--episode", opts.episode, "--queue", opts.queue, "--slug", opts.slug,
      "--index", "1"
    ]);
    assert.equal(result.status, 0, "Lauf muss durchlaufen: " + result.stderr);

    const record = JSON.parse(fs.readFileSync(
      path.join(opts.queue, opts.slug, "episode.json"), "utf8"));
    assert.equal(record.status, "bereit", "die Kette ist vollstaendig: " + record.gaps.join("; "));
    assert.equal(record.source.exerciseIndex, 1);
    assert.equal(record.source.shownPrompt, "Wie gross ist der vierte Winkel?");
    assert.match(record.caption, /Wie gross ist der vierte Winkel\?/,
      "die Caption nennt nicht die Aufgabe aus dem Bild");
    assert.doesNotMatch(record.caption, /Wie viel ist das\?/,
      "die Caption beschreibt eine Aufgabe, die nicht im Clip steht");
    /* Der Bereich in der Caption muss zum gezeigten Thema passen. */
    assert.match(record.caption, /Bereich winkel/, "der Bereich in der Caption passt nicht zur Aufgabe");
    /* Und die Hashtags folgen demselben Beleg statt allen Themen der Auswahl. */
    assert.ok(record.hashtags.indexOf("#winkel") !== -1, "das Thema der gezeigten Aufgabe fehlt");
    assert.equal(record.hashtags.indexOf("#diagramm"), -1,
      "ein Thema einer Aufgabe taucht auf, die nicht im Clip steht");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* 2c — Ein Index ohne Beleg wird nicht still geglaubt. */
function testCaptionNeedsProof() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-beleg-"));
  try {
    /* Manifest ohne exerciseIndex: welche Aufgabe im Clip steht, ist unbelegt. */
    const noProof = makeChain(dir, function (given) {
      fs.writeFileSync(path.join(given.frames, "manifest.json"),
        JSON.stringify({ frameSetSha256: "HASH-FRAMES" }));
    });
    const out = run([
      "--clip", noProof.clip, "--frames", noProof.frames, "--report", noProof.report,
      "--episode", noProof.episode, "--queue", noProof.queue, "--slug", noProof.slug
    ]);
    assert.match(out.stdout, /QUEUE_UNVOLLSTAENDIG/, "ein fehlender Beleg gilt als Freigabe");
    const record = JSON.parse(fs.readFileSync(
      path.join(noProof.queue, noProof.slug, "episode.json"), "utf8"));
    assert.ok(record.gaps.some(function (gap) { return /Aufgabenindex/.test(gap); }),
      "der fehlende Beleg wurde nicht als Luecke genannt: " + JSON.stringify(record.gaps));

    /* Manifest nennt einen Generator, der an dieser Stelle nicht steht:
       das Bild zeigt eine andere Aufgabe als die Auswahl daneben. */
    const foreign = makeChain(dir, function (given) {
      fs.writeFileSync(path.join(given.frames, "manifest.json"), JSON.stringify({
        frameSetSha256: "HASH-FRAMES", exerciseIndex: 0, generator: "GEN_TEST_C"
      }));
    });
    const second = run([
      "--clip", foreign.clip, "--frames", foreign.frames, "--report", foreign.report,
      "--episode", foreign.episode, "--queue", foreign.queue, "--slug", foreign.slug
    ]);
    assert.match(second.stdout, /QUEUE_UNVOLLSTAENDIG/, "ein fremder Generator gilt als Freigabe");
    const other = JSON.parse(fs.readFileSync(
      path.join(foreign.queue, foreign.slug, "episode.json"), "utf8"));
    assert.ok(other.gaps.some(function (gap) { return /Generator/.test(gap); }),
      "die Abweichung wurde nicht als Luecke genannt: " + JSON.stringify(other.gaps));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}


/* 3 — Unvollstaendige Belege gelten nicht als freigegeben. */
function testIncompleteEpisode() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-luecke-"));
  try {
    /* MP4 fehlt auf der Platte. */
    const withoutClip = makeChain(dir, function (opts) { fs.rmSync(opts.clip); });
    const result = run([
      "--clip", withoutClip.clip, "--frames", withoutClip.frames,
      "--report", withoutClip.report, "--episode", withoutClip.episode,
      "--queue", withoutClip.queue, "--slug", withoutClip.slug
    ]);
    assert.equal(result.status, 0, "eine Luecke bricht den Lauf nicht ab");
    assert.match(result.stdout, /QUEUE_UNVOLLSTAENDIG/, "Luecke wurde als Erfolg gemeldat");
    assert.doesNotMatch(result.stdout, /(^|\s)QUEUE_OK(\s|$)/m);

    const record = JSON.parse(fs.readFileSync(
      path.join(withoutClip.queue, withoutClip.slug, "episode.json"), "utf8"));
    assert.equal(record.status, "unvollstaendig");
    assert.ok(record.gaps.length > 0, "Luecke wurde nicht benannt");
    assert.ok(record.gaps.some(function (gap) { return /MP4 fehlt/.test(gap); }),
      "fehlendes MP4 nicht als Luecke genannt: " + JSON.stringify(record.gaps));
    /* Ohne Datei darf auch keine Datei behauptet werden. */
    assert.ok(!fs.existsSync(path.join(withoutClip.queue, withoutClip.slug, "clip.mp4")));

    /* Ein nicht gegengepruefter Lauf ist ebenfalls keine Freigabe. */
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-ung-"));
    try {
      const unverified = makeChain(dir2, function (given) {
        const report = JSON.parse(fs.readFileSync(given.report, "utf8"));
        report.verified = false;
        fs.writeFileSync(given.report, JSON.stringify(report));
      });
      const out = run([
        "--clip", unverified.clip, "--frames", unverified.frames,
        "--report", unverified.report, "--episode", unverified.episode,
        "--queue", unverified.queue, "--slug", unverified.slug
      ]);
      assert.match(out.stdout, /QUEUE_UNVOLLSTAENDIG/);
      const record2 = JSON.parse(fs.readFileSync(
        path.join(unverified.queue, unverified.slug, "episode.json"), "utf8"));
      assert.ok(record2.gaps.some(function (gap) { return /nicht gegengeprueft/.test(gap); }),
        "ungepruefter Lauf nicht als Luecke genannt");
    } finally {
      fs.rmSync(dir2, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* 4 — Die Hash-Kette wird an allen drei Gliedern geprueft. */
function testHashChain() {
  /* Frames und Clip gehoeren zusammen, der Bericht ist aelter. Das ist der
     Fall, den eine nur zweigliedrige Pruefung durchwinken wuerde. */
  const stale = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-stale-"));
  try {
    const opts = makeChain(stale, function (given) {
      const report = JSON.parse(fs.readFileSync(given.report, "utf8"));
      report.frameSetSha256 = "HASH-AUS-ALTEM-LAUF";
      fs.writeFileSync(given.report, JSON.stringify(report));
    });
    const result = run([
      "--clip", opts.clip, "--frames", opts.frames, "--report", opts.report,
      "--episode", opts.episode, "--queue", opts.queue, "--slug", opts.slug
    ]);
    assert.match(result.stdout, /QUEUE_UNVOLLSTAENDIG/, "veralteter Bericht wurde durchgewinkt");
    const record = JSON.parse(fs.readFileSync(
      path.join(opts.queue, opts.slug, "episode.json"), "utf8"));
    assert.ok(record.gaps.some(function (gap) { return /veraltet/.test(gap); }),
      "veralteter Bericht nicht als Luecke genannt: " + JSON.stringify(record.gaps));
  } finally {
    fs.rmSync(stale, { recursive: true, force: true });
  }

  /* Clip aus einem fremden Framesatz. */
  const foreign = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-fremd-"));
  try {
    const opts = makeChain(foreign, function (given) {
      fs.writeFileSync(path.join(given.frames, "manifest.json"),
        JSON.stringify({ frameSetSha256: "Ganz-Anderer-Hash" }));
    });
    const result = run([
      "--clip", opts.clip, "--frames", opts.frames, "--report", opts.report,
      "--episode", opts.episode, "--queue", opts.queue, "--slug", opts.slug
    ]);
    assert.match(result.stdout, /QUEUE_UNVOLLSTAENDIG/, "fremder Framesatz wurde durchgewinkt");
    const record = JSON.parse(fs.readFileSync(
      path.join(opts.queue, opts.slug, "episode.json"), "utf8"));
    assert.ok(record.gaps.some(function (gap) { return /Hash-Kette/.test(gap); }),
      "gebrochene Kette nicht als Luecke genannt: " + JSON.stringify(record.gaps));
  } finally {
    fs.rmSync(foreign, { recursive: true, force: true });
  }
}


/* 5 — Die Freigabe ist ein manueller, eigener Schritt. */
function testManualRelease() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-frei-"));
  try {
    const opts = makeChain(dir);
    run([
      "--clip", opts.clip, "--frames", opts.frames, "--report", opts.report,
      "--episode", opts.episode, "--queue", opts.queue, "--slug", opts.slug
    ]);
    const manifest = path.join(opts.queue, opts.slug, "episode.json");

    /* Ein reiner Schreiblauf darf noch nichts freigeben. */
    const before = JSON.parse(fs.readFileSync(manifest, "utf8"));
    assert.equal(before.status, "bereit");
    assert.equal(before.releasedAt, null, "der Schreiblauf hat freigegeben");

    /* Erst der ausdrueckliche Aufruf. */
    const released = run(["--release", path.join(opts.queue, opts.slug)]);
    assert.equal(released.status, 0, "Freigabe muss klappen: " + released.stderr);
    assert.match(released.stdout, /QUEUE_OK/);
    const after = JSON.parse(fs.readFileSync(manifest, "utf8"));
    assert.equal(after.status, "freigegeben");
    assert.ok(after.releasedAt, "Freigabezeit fehlt");
    assert.equal(after.releasedBy, "manuell");

    /* Auflistung zeigt den neuen Stand. */
    const listed = run(["--list", opts.queue]);
    assert.match(listed.stdout, /freigegeben/);
    assert.match(listed.stdout, /test-i0/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* 6 — Eine lueckenhafte Episode laesst sich nicht freigeben. */
function testReleaseRefusesIncomplete() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-block-"));
  try {
    const opts = makeChain(dir, function (given) { fs.rmSync(given.clip); });
    run([
      "--clip", opts.clip, "--frames", opts.frames, "--report", opts.report,
      "--episode", opts.episode, "--queue", opts.queue, "--slug", opts.slug
    ]);
    const blocked = run(["--release", path.join(opts.queue, opts.slug)]);
    assert.notEqual(blocked.status, 0, "unvollstaendige Episode wurde freigegeben");
    assert.match(blocked.stderr, /nicht freigabefaehig/);
    const record = JSON.parse(fs.readFileSync(
      path.join(opts.queue, opts.slug, "episode.json"), "utf8"));
    assert.equal(record.status, "unvollstaendig", "Status wurde trotz Fehler gesetzt");
    assert.equal(record.releasedAt, null);

    /* Ohne Manifest gibt es nichts freizugeben. */
    const empty = run(["--release", path.join(dir, "gibtsnicht")]);
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /Keine Queue-Episode/);

    /* Manifest sagt bereit, MP4 fehlt trotzdem: auch das wird abgelehnt. */
    const lying = path.join(dir, "gelogen");
    fs.mkdirSync(lying);
    fs.writeFileSync(path.join(lying, "episode.json"), JSON.stringify({
      status: "bereit", gaps: [],
      artifacts: { video: "clip.mp4" }
    }));
    const caught = run(["--release", lying]);
    assert.notEqual(caught.status, 0, "Episode ohne MP4 wurde freigegeben");
    assert.match(caught.stderr, /MP4 fehlt/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* 7 — Geschrieben wird atomar; eine leere Queue ist kein Fehler. */
function testAtomicWriteAndEmptyQueue() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-queue-atom-"));
  try {
    const target = path.join(dir, "ziel.json");
    queue.writeAtomic(target, '{"a":1}');
    assert.equal(fs.readFileSync(target, "utf8"), '{"a":1}');
    /* Umbenannt statt ueberschrieben: keine Reste mit tmp-Suffix. */
    assert.deepEqual(fs.readdirSync(dir), ["ziel.json"], "temporaere Datei blieb liegen");

    queue.writeAtomic(target, '{"a":2}');
    assert.equal(fs.readFileSync(target, "utf8"), '{"a":2}', "Ueberschreiben hat nicht gewirkt");

    /* Eine leere Queue ist ein gueltiger, wenn auch leerer Zustand. */
    const empty = run(["--list", path.join(dir, "leer")]);
    assert.equal(empty.status, 0, "leere Queue darf kein Fehler sein");
    assert.match(empty.stdout, /leer/);

    assert.deepEqual(queue.list(path.join(dir, "gibtsnicht")), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/* 8 — Slug und Hashtags sind abgeleitet, nicht geraten. */
function testSlugAndHashtags() {
  assert.equal(queue.buildSlug("p7-3-5", 0, ""), "p7-3-5-i0");
  assert.equal(queue.buildSlug("p7-3-5", 2, ""), "p7-3-5-i2");
  assert.equal(queue.buildSlug("p7-3-5", 0, "fest"), "fest");

  /* Getrennte Indizes duerfen nicht im selben Ordner landen. */
  assert.notEqual(queue.buildSlug("p7-3-5", 0, ""), queue.buildSlug("p7-3-5", 1, ""));

  const episode = { exercises: [{ topic: "diagramm" }, { topic: "diagramm" }, { topic: "bruch" }] };
  /* Die Tags folgen der Aufgabe, die im Clip steht. Deshalb wird hier eine
     konkrete Aufgabe uebergeben, nicht die ganze Auswahl. */
  const tags = queue.buildHashtags({ exercise: episode.exercises[0] });
  assert.equal(tags.filter(function (tag) { return tag === "#diagramm"; }).length, 1,
    "doppelte Themen wurden nicht entfernt");
  assert.equal(tags.indexOf("#bruch"), -1, "ein Thema ohne Auftrag im Clip wurde getaggt");
  assert.equal(tags.length, queue.BASE_HASHTAGS.length + 1, "unerwartete Tag-Anzahl");
  const other = queue.buildHashtags({ exercise: episode.exercises[2] });
  assert.ok(other.indexOf("#bruch") !== -1, "zweites Thema fehlt");

  /* Ohne Thema darf kein leerer Tag entstehen. */
  const without = queue.buildHashtags({ exercise: { prompt: "x" } });
  assert.deepEqual(without, queue.BASE_HASHTAGS, "Leerer Tag wurde angehaengt");
}

const tests = [
  testArgumentHandling,
  testCompleteEpisode,
  testCaptionFollowsShownExercise,
  testCaptionNeedsProof,
  testIncompleteEpisode,
  testHashChain,
  testManualRelease,
  testReleaseRefusesIncomplete,
  testAtomicWriteAndEmptyQueue,
  testSlugAndHashtags
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
process.stdout.write("QUEUE_OK (" + tests.length + " Tests)\n");
