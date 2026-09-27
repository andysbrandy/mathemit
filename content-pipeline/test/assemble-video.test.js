#!/usr/bin/env node
"use strict";

/*
 * P7.3.4 — Video-Montage: Manifest-Prüfung, ffmpeg-Argumente und Messung.
 * Der Lauf mit echtem ffmpeg läuft nur, wenn ffmpeg/ffprobe vorhanden sind;
 * die reine Argument- und Manifestlogik wird immer geprüft.
 */

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PIPELINE = path.resolve(__dirname, "..");
const ASSEMBLE = path.join(PIPELINE, "assemble-video.js");
const runner = require("../lib/ffmpeg-runner");
const video = require("../assemble-video");

const FFMPEG = runner.findFfmpeg();
const FFPROBE = runner.findFfprobe();
/* Ohne ffmpeg zeigen die Tests auf /bin/true: sie laufen, echte Läufe nicht. */
const ENV = { FFMPEG_PATH: FFMPEG || "/bin/true", FFPROBE_PATH: FFPROBE || "/bin/true" };

function run(args, env) {
  return childProcess.spawnSync(process.execPath, [ASSEMBLE].concat(args), {
    cwd: PIPELINE,
    encoding: "utf8",
    env: Object.assign({}, process.env, env || ENV)
  });
}

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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

/*
 * Echtes 1080x1920-Bild mit Kacheltauschen. Echtes Bild, damit ffmpeg
 * wirklich kodiert; wenig Entropie, damit 450 Dateien klein bleiben.
 */
function noisePng(seed) {
  const width = 1080;
  const height = 1920;
  const block = 32;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const blockRow = Math.floor(y / block);
    for (let x = 0; x < width; x += 1) {
      const n = (Math.imul(seed * 73856093 ^ Math.imul(blockRow * 19349663, 83492791)
        ^ Math.imul(Math.floor(x / block) * 83492791, 2971215073), 2654435761) >>> 16) & 255;
      raw[rowStart + 1 + x * 3] = n;
      raw[rowStart + 2 + x * 3] = (n * 7 + 40) & 255;
      raw[rowStart + 3 + x * 3] = (n * 13 + 90) & 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    PNG_HEADER,
    pngChunk("IHDR", header),
    pngChunk("IDAT", require("node:zlib").deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

/*
 * Legt einen Framesatz mit gültigem Manifest an. mutate darf das Manifest
 * verfaelschen, body erzeugt die PNG-Dateien. standard 60 statt 450 haelt
 * die Argument- und Manifesttests schnell.
 */
function makeFrames(workDir, name, mutate, body, totalFrames) {
  const dir = path.join(workDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const count = totalFrames || 60;
  const frames = [];
  for (let frame = 0; frame < count; frame += 1) {
    const file = "frame-" + String(frame).padStart(4, "0") + ".png";
    const buffer = body ? body(frame) : PNG_HEADER;
    fs.writeFileSync(path.join(dir, file), buffer);
    frames.push({
      frame: frame,
      timeMs: Math.round(frame * 1000 / 30),
      segment: "hook",
      file: file,
      bytes: buffer.length,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex")
    });
  }
  const manifest = {
    schemaVersion: 1,
    stage: { width: 1080, height: 1920 },
    fps: 30,
    totalFrames: count,
    totalSeconds: count / 30,
    totalMs: Math.round(count * 1000 / 30),
    renderedFrames: count,
    complete: true,
    pauseMs: 2000,
    frameSetSha256: "b".repeat(64),
    frames: frames
  };
  if (mutate) mutate(manifest, dir);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

/* 1 — Optionen werden geprueft, nicht stillschweigend uebernommen. */
function testOptionValidation() {
  const bad = run(["--crf", "99"]);
  assert.notEqual(bad.status, 0, "CRF 99 muss scheitern");
  assert.match(bad.stderr, /CRF/);

  const badPreset = run(["--preset", "hyperfast"]);
  assert.notEqual(badPreset.status, 0, "Unbekanntes Preset muss scheitern");
  assert.match(badPreset.stderr, /Preset/);

  const unknown = run(["--gibtsnicht"]);
  assert.notEqual(unknown.status, 0, "Unbekannte Option muss scheitern");
  assert.match(unknown.stderr, /Unbekannte Option/);

  const missingValue = run(["--out"]);
  assert.notEqual(missingValue.status, 0, "Fehlender Wert muss scheitern");
}

/* 2 — Fehlendes ffmpeg bricht ab, statt still zu ueberspringen. */
function testMissingFfmpeg() {
  const result = run(["--ffmpeg", "/pfad/zu/nicht/vorhanden", "--ffprobe", "/pfad/zu/nicht/vorhanden",
    "--frames", "work/frames", "--out", "work/video/x.mp4"]);
  assert.notEqual(result.status, 0, "Fehlendes ffmpeg muss scheitern");
  assert.match(result.stderr, /ffmpeg nicht gefunden/);
}

/* 3 — Unvollstaendige, falsche oder beschaedigte Framesaetze werden abgelehnt. */
function testFrameSetValidation() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p734-"));
  const out = path.join(workDir, "x.mp4");
  try {
    const noManifest = run(["--frames", workDir, "--out", out]);
    assert.notEqual(noManifest.status, 0, "Fehlendes manifest.json muss scheitern");
    assert.match(noManifest.stderr, /manifest\.json/);

    const badSchema = makeFrames(workDir, "schema", function (m) { m.schemaVersion = 7; });
    assert.notEqual(run(["--frames", badSchema, "--out", out]).status, 0, "Falsches Schema muss scheitern");
    assert.match(run(["--frames", badSchema, "--out", out]).stderr, /schemaVersion 1/);

    const partial = makeFrames(workDir, "partial", function (m) {
      m.complete = false;
      m.renderedFrames = 12;
    });
    const partialRun = run(["--frames", partial, "--out", out]);
    assert.notEqual(partialRun.status, 0, "Unvollstaendiger Framesatz muss scheitern");
    assert.match(partialRun.stderr, /unvollständig/);

    const wide = makeFrames(workDir, "wide", function (m) {
      m.stage = { width: 1920, height: 1080 };
    });
    const wideRun = run(["--frames", wide, "--out", out]);
    assert.notEqual(wideRun.status, 0, "Querformat muss scheitern");
    assert.match(wideRun.stderr, /1080x1920/);

    const slow = makeFrames(workDir, "slow", function (m) { m.fps = 10; });
    const slowRun = run(["--frames", slow, "--out", out]);
    assert.notEqual(slowRun.status, 0, "Zu niedrige Bildrate muss scheitern");
    assert.match(slowRun.stderr, /Bildrate/);

    const missing = makeFrames(workDir, "missing", function (manifest, dir) {
      fs.unlinkSync(path.join(dir, "frame-0010.png"));
    });
    const missingRun = run(["--frames", missing, "--out", out]);
    assert.notEqual(missingRun.status, 0, "Fehlender Frame muss scheitern");
    assert.match(missingRun.stderr, /Frame fehlt/);

    /* Erst nach dem Manifest geschrieben: sonst entsteht kein Fremdframe,
     * sondern nur eine Datei, die das Manifest korrekt beschreibt. */
    const tampered = makeFrames(workDir, "tampered", function (manifest, dir) {
      fs.writeFileSync(path.join(dir, "frame-0005.png"), Buffer.concat([PNG_HEADER, Buffer.from([0])]));
    });
    const tamperedRun = run(["--frames", tampered, "--out", out]);
    assert.notEqual(tamperedRun.status, 0, "Veränderte Frame-Datei muss scheitern");
    assert.match(tamperedRun.stderr, /Bytes, Manifest meldet/);

    /* Gleiche Laenge, anderer Inhalt: nur der SHA-Vergleich sieht das. */
    const swapped = makeFrames(workDir, "swapped", function (manifest, dir) {
      const altered = Buffer.from(PNG_HEADER);
      altered[altered.length - 1] ^= 0xff;
      fs.writeFileSync(path.join(dir, "frame-0007.png"), altered);
    });
    const swappedRun = run(["--frames", swapped, "--out", out]);
    assert.notEqual(swappedRun.status, 0, "Ausgetauschter Frame muss scheitern");
    assert.match(swappedRun.stderr, /SHA-256/);

    const noHash = makeFrames(workDir, "nohash", function (m) { m.frameSetSha256 = "kein-hash"; });
    const noHashRun = run(["--frames", noHash, "--out", out]);
    assert.notEqual(noHashRun.status, 0, "Fehlender frameSetSha256 muss scheitern");
    assert.match(noHashRun.stderr, /frameSetSha256/);

    /* Ein gueltiger Framesatz muss die Pruefung bestehen. */
    const good = makeFrames(workDir, "good");
    const manifest = video.readFrameManifest(good);
    assert.equal(manifest.totalFrames, 60);
    assert.equal(manifest.frames.length, 60);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/* 4 — Die ffmpeg-Argumente fixieren Codec, Bildrate, Farbkennzeichnung und Stille. */
function testFfmpegArgs() {
  const args = video.ffmpegArgs({
    fps: 30,
    totalFrames: 450,
    crf: 18,
    preset: "medium",
    outPath: "/tmp/clip.mp4"
  }, "/tmp/frames");

  const value = function (flag) {
    const at = args.indexOf(flag);
    return at === -1 ? null : args[at + 1];
  };
  assert.equal(args[args.length - 1], "/tmp/clip.mp4", "Ziel muss letztes Argument sein");
  assert.equal(value("-framerate"), "30");
  assert.equal(value("-start_number"), "0");
  assert.equal(value("-i"), path.join("/tmp/frames", "frame-%04d.png"));
  assert.equal(value("-frames:v"), "450");
  assert.equal(value("-c:v"), "libx264");
  assert.equal(value("-profile:v"), "high");
  assert.equal(value("-pix_fmt"), "yuv420p");
  assert.equal(value("-crf"), "18");
  assert.equal(value("-preset"), "medium");
  assert.equal(value("-r"), "30");
  assert.equal(value("-fps_mode"), "cfr");
  assert.equal(value("-color_primaries"), "bt709");
  assert.equal(value("-color_trc"), "bt709");
  assert.equal(value("-colorspace"), "bt709");
  assert.equal(value("-movflags"), "+faststart");
  assert.ok(args.includes("-an"), "Clip ist stumm, Tonspur muss abgeschaltet sein");
  assert.ok(args.includes("-y"), "Vorhandene Datei wird überschrieben");
  assert.ok(args.includes("-nostdin"), "ffmpeg darf nicht auf Eingaben warten");
  /* Genau ein Eingang: kein zweites Video, kein Netzwerk. */
  assert.equal(args.filter(function (arg) { return arg === "-i"; }).length, 1);
  assert.ok(!args.some(function (arg) { return /^https?:/.test(arg); }), "Keine Netzwerkquellen");
}

/* 5 — Die ffprobe-Auswertung lehnt falsche Eckdaten ab. */
function testProbeEvaluation() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p734-"));
  const base = {
    codec_name: "h264",
    profile: "High",
    pix_fmt: "yuv420p",
    width: 1080,
    height: 1920,
    avg_frame_rate: "30/1",
    r_frame_rate: "30/1",
    nb_frames: "450",
    codec_type: "video"
  };
  const wrap = function (stream, duration) {
    return { streams: [Object.assign({}, stream)], format: { duration: String(duration) } };
  };
  const manifest = { fps: 30, totalFrames: 450 };
  const out = path.join(workDir, "clip.mp4");
  assert.equal(runner.parseRate("30/1"), 30);
  assert.ok(Number.isNaN(runner.parseRate("30")), "Rate ohne Bruch ist ungueltig");
  assert.equal(runner.firstStream(wrap(base, 15), "audio"), null, "Clip muss stumm sein");
  assert.equal(runner.firstStream(wrap(base, 15), "video").codec_name, "h264");

  const cases = [
    [Object.assign({}, base, { width: 1920, height: 1080 }), 15, /1080x1920/],
    [Object.assign({}, base, { codec_name: "vp9" }), 15, /h264/],
    [Object.assign({}, base, { pix_fmt: "yuv444p" }), 15, /yuv420p/],
    [Object.assign({}, base, { avg_frame_rate: "24/1" }), 15, /fps/],
    [Object.assign({}, base, { nb_frames: "449" }), 15, /Bilder/],
    [base, 12, /dauert/]
  ];
  cases.forEach(function (entry) {
    assert.throws(function () {
      video.verifyVideo(wrap(entry[0], entry[1]), manifest, path.join(workDir, "clip.mp4"));
    }, entry[2], "ffprobe-Auswertung muss " + entry[2] + " melden");
  });
  assert.throws(function () {
    video.verifyVideo({ streams: [], format: {} }, manifest, out);
  }, /Videostream/);
  fs.rmSync(workDir, { recursive: true, force: true });
}

/* 6 — Echte Montage: der fertige Clip haelt alle Zusagen ein. */
function testRealEncode() {
  if (!FFMPEG || !FFPROBE) {
    process.stdout.write("SKIP testRealEncode (kein ffmpeg/ffprobe gefunden)\n");
    return;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p734-"));
  try {
    const frames = makeFrames(workDir, "frames", null, function (frame) {
      /* Echte 1080x1920-Bilder, damit der Encoder nicht an 8-Byte-Daten scheitert. */
      return noisePng(frame);
    }, 450);

    const out = path.join(workDir, "clip.mp4");
    const result = run(["--frames", frames, "--out", out, "--crf", "30", "--preset", "ultrafast"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);

    assert.equal(report.codec, "h264");
    assert.equal(report.resolution, "1080x1920");
    assert.equal(report.aspect, "9:16");
    assert.equal(report.fps, 30);
    assert.equal(report.frameCount, 450);
    assert.equal(report.durationSeconds, 15);
    assert.equal(report.audio, false);
    assert.ok(report.bytes > 100000, "Clip ist verdächtig klein");
    assert.ok(fs.existsSync(path.join(workDir, "clip-manifest.json")), "Clip-Manifest fehlt");

    const saved = JSON.parse(fs.readFileSync(path.join(workDir, "clip-manifest.json"), "utf8"));
    assert.equal(saved.frameCount, 450);
    assert.equal(saved.sourceFrameSetSha256, "b".repeat(64));
    assert.equal(saved.audio, false);

    const probe = runner.probeVideo(FFPROBE, out);
    assert.equal(runner.firstStream(probe, "audio"), null, "Clip darf keine Tonspur haben");
    assert.equal(probe.streams.length, 1, "Clip darf nur einen Stream haben");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/* 7 — Ein echter Clip muss bei 9:16-Masse nicht beschnitten sein. */
function testNoCrop() {
  if (!FFMPEG || !FFPROBE) {
    process.stdout.write("SKIP testNoCrop (kein ffmpeg/ffprobe gefunden)\n");
    return;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p734-"));
  try {
    const source = path.join(workDir, "quelle.png");
    /* Bild mit farbigem Rand:Bei Beschnitt fehlt er, bei Skalierung bleibt er. */
    const result = childProcess.spawnSync(process.execPath, ["-e", [
      "const zlib=require('zlib');",
      "const w=1080,h=1920,st=w*3,raw=Buffer.alloc((st+1)*h);",
      "for(let y=0;y<h;y++){const rs=y*(st+1);raw[rs]=0;",
      "for(let x=0;x<w;x++){const edge=x<40||x>w-41||y<40||y>h-41;",
      "raw[rs+1+x*3]=edge?220:253;raw[rs+2+x*3]=edge?40:246;raw[rs+3+x*3]=edge?40:231;}}",
      "const T=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;",
      "for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c;}return t;})();",
      "const crc=b=>{let c=-1;for(let i=0;i<b.length;i++)c=T[(c^b[i])&0xff]^(c>>>8);return (c^-1)>>>0;};",
      "const ck=(t,b)=>{const l=Buffer.alloc(4);l.writeUInt32BE(b.length,0);",
      "const p=Buffer.concat([Buffer.from(t,'ascii'),b]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(p),0);",
      "return Buffer.concat([l,p,c]);};",
      "const hd=Buffer.alloc(13);hd.writeUInt32BE(w,0);hd.writeUInt32BE(h,4);hd[8]=8;hd[9]=2;",
      "process.stdout.write(Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),",
      "ck('IHDR',hd),ck('IDAT',zlib.deflateSync(raw)),ck('IEND',Buffer.alloc(0))]));"
    ].join("")], { maxBuffer: 32 * 1024 * 1024 });
    assert.equal(result.status, 0, "Bildgenerator fehlgeschlagen");
    fs.writeFileSync(source, result.stdout);

    const out = path.join(workDir, "einzel.mp4");
    const args = video.ffmpegArgs({
      fps: 30,
      totalFrames: 30,
      crf: 30,
      preset: "ultrafast",
      outPath: out
    }, path.dirname(source));
    /* Auf eine Einzeldatei statt einer Sequenz zeigen: der Zaehler
     * "-start_number" gehoert zum Sequenz-Demuxer und wird entfernt. */
    args.splice(args.indexOf("-i") - 2, 2);
    args[args.indexOf("-i") + 1] = source;
    runner.encodeVideo(FFMPEG, args);
    assert.ok(fs.existsSync(out), "Clip fehlt");

    const probe = runner.probeVideo(FFPROBE, out);
    const stream = runner.firstStream(probe, "video");
    assert.equal(stream.width, 1080, "9:16 darf nicht beschnitten werden");
    assert.equal(stream.height, 1920);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

const tests = [
  testOptionValidation,
  testMissingFfmpeg,
  testFrameSetValidation,
  testFfmpegArgs,
  testProbeEvaluation,
  testRealEncode,
  testNoCrop
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
process.stdout.write("ASSEMBLE_VIDEO_OK (" + tests.length + " Tests)\n");

