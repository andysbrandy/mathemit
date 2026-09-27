#!/usr/bin/env node
"use strict";

/*
 * P7.3.4 — Video-Montage mit ffmpeg.
 * Aus einem vollstaendigen Framesatz (P7.3.3) entsteht ein 9:16-Clip mit
 * festen Codecs. ffmpeg erzeugt, ffprobe beweist: Erst wenn Aufloesung,
 * Seitenverhaeltnis, Codec, Pixelformat, Bildrate, Framezahl und Laufzeit
 * den Vorgaben der Zeitachse entsprechen, gilt der Clip als fertig.
 * Sonst bricht der Lauf ab und es bleibt kein Video zurueck.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const runner = require("./lib/ffmpeg-runner");
const scene = require("./lib/isolated-scene");

const DEFAULT_FRAMES_DIR = "content-pipeline/work/frames";
const DEFAULT_OUT = "content-pipeline/work/video/clip.mp4";
const MANIFEST_NAME = "manifest.json";
const REPORT_NAME = "clip-manifest.json";
const MIN_SECONDS = 15;
const MAX_SECONDS = 25;
const MIN_FPS = 24;
const MAX_FPS = 60;
const MIN_BYTES = 100000;
const PRESETS = ["ultrafast", "superfast", "veryfast", "faster", "fast",
  "medium", "slow", "slower", "veryslow"];

const fail = scene.fail;
const resolvePipelinePath = scene.resolvePipelinePath;
const writeAtomic = scene.writeAtomic;

function usage() {
  return [
    "Verwendung: node content-pipeline/assemble-video.js [Optionen]",
    "",
    "  --frames <verzeichnis> Frames inkl. manifest.json (Standard: " + DEFAULT_FRAMES_DIR + ")",
    "  --out <datei.mp4>      Zieldatei (Standard: " + DEFAULT_OUT + ")",
    "  --crf <0–51>           Qualitaetsstufe, kleiner = besser (Standard: 18)",
    "  --preset <name>        ffmpeg-Preset, " + PRESETS.join("/") + " (Standard: medium)",
    "  --ffmpeg <pfad>        Expliziter ffmpeg-Pfad",
    "  --ffprobe <pfad>       Expliziter ffprobe-Pfad",
    "  --help                 Diese Hilfe anzeigen"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = {
    frames: DEFAULT_FRAMES_DIR,
    out: DEFAULT_OUT,
    crf: 18,
    preset: "medium",
    ffmpeg: runner.findFfmpeg(),
    ffprobe: runner.findFfprobe()
  };
  const known = ["--frames", "--out", "--crf", "--preset", "--ffmpeg", "--ffprobe"];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      return null;
    }
    if (!known.includes(arg)) fail("Unbekannte Option: " + arg + "\n\n" + usage());
    if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
    const value = argv[++i];
    if (arg === "--frames") opts.frames = value;
    if (arg === "--out") opts.out = value;
    if (arg === "--crf") opts.crf = Number(value);
    if (arg === "--preset") opts.preset = value;
    if (arg === "--ffmpeg") opts.ffmpeg = value;
    if (arg === "--ffprobe") opts.ffprobe = value;
  }
  if (!opts.frames.trim() || !opts.out.trim()) fail("Frames- und Ausgabepfad dürfen nicht leer sein.");
  if (!Number.isInteger(opts.crf) || opts.crf < 0 || opts.crf > 51) {
    fail("CRF muss eine ganze Zahl zwischen 0 und 51 sein, ist aber " + opts.crf + ".");
  }
  if (!PRESETS.includes(opts.preset)) {
    fail("Unbekanntes ffmpeg-Preset: " + opts.preset + " (erlaubt: " + PRESETS.join(", ") + ").");
  }
  if (!opts.ffmpeg) fail("Kein ffmpeg gefunden. Setze FFMPEG_PATH oder --ffmpeg.");
  if (!opts.ffprobe) fail("Kein ffprobe gefunden. Setze FFPROBE_PATH oder --ffprobe.");
  return opts;
}
/*
 * Der Framesatz aus P7.3.3 ist die einzige zulaessige Quelle. Ein
 * unvollstaendiger Lauf liefert hoechstens etwas, das wie ein Video
 * aussieht, aber keines ist — deshalb wird streng geprueft.
 */
function readFrameManifest(framesDir) {
  const manifestPath = path.join(framesDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    fail("Kein " + MANIFEST_NAME + " in " + framesDir + " — erst mit render-frames.js rendern.");
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(MANIFEST_NAME + " ist kein gültiges JSON: " + error.message);
  }
  if (!manifest || manifest.schemaVersion !== 1) {
    fail(MANIFEST_NAME + " hat kein unterstütztes Format (schemaVersion 1).");
  }
  if (manifest.complete !== true) {
    fail("Framesatz ist unvollständig (" + manifest.renderedFrames + "/" + manifest.totalFrames
      + " Frames) — nur ein vollständiger Lauf darf montiert werden.");
  }
  if (!Array.isArray(manifest.frames) || manifest.frames.length !== manifest.totalFrames) {
    fail(MANIFEST_NAME + " listet nicht genau " + manifest.totalFrames + " Frames.");
  }
  const stage = manifest.stage || {};
  if (stage.width !== 1080 || stage.height !== 1920) {
    fail("Framesatz ist nicht 1080x1920, sondern " + stage.width + "x" + stage.height + ".");
  }
  if (!Number.isInteger(manifest.fps) || manifest.fps < MIN_FPS || manifest.fps > MAX_FPS) {
    fail("Bildrate des Framesatzes liegt außerhalb " + MIN_FPS + "–" + MAX_FPS + ": " + manifest.fps);
  }
  if (typeof manifest.frameSetSha256 !== "string" || !/^[0-9a-f]{64}$/.test(manifest.frameSetSha256)) {
    fail(MANIFEST_NAME + " enthält keine gültige frameSetSha256.");
  }
  /* Jeder Frame muss liegen, fortlaufend nummeriert und unveraendert sein. */
  manifest.frames.forEach(function (frame, position) {
    if (frame.frame !== position) fail(MANIFEST_NAME + " ist nicht framesortiert (Position " + position + ").");
    const file = path.join(framesDir, frame.file);
    if (!fs.existsSync(file)) fail("Frame fehlt auf der Platte: " + frame.file);
    const bytes = fs.statSync(file).size;
    if (bytes !== frame.bytes) {
      fail("Frame " + frame.file + " hat " + bytes + " Bytes, Manifest meldet " + frame.bytes + ".");
    }
    /* Groesse allein beweist nichts: ein Frame mit gleicher Laenge, aber
     * anderem Inhalt, ist genauso fremd wie einer mit anderer Laenge. */
    if (typeof frame.sha256 === "string" && /^[0-9a-f]{64}$/.test(frame.sha256)) {
      const digest = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
      if (digest !== frame.sha256) {
        fail("Frame " + frame.file + " weicht vom Manifest ab (SHA-256 " + digest.slice(0, 12)
          + " statt " + frame.sha256.slice(0, 12) + ").");
      }
    }
  });
  return manifest;
}
/* Feste Codecs, feste Farbkennzeichnung, exakt so viele Bilder wie Frames. */
function ffmpegArgs(opts, framesDir) {
  return [
    "-hide_banner",
    "-nostdin",
    "-loglevel", "error",
    "-y",
    "-framerate", String(opts.fps),
    "-start_number", "0",
    "-i", path.join(framesDir, "frame-%04d.png"),
    "-frames:v", String(opts.totalFrames),
    "-an",
    "-c:v", "libx264",
    "-profile:v", "high",
    "-pix_fmt", "yuv420p",
    "-crf", String(opts.crf),
    "-preset", opts.preset,
    "-r", String(opts.fps),
    "-fps_mode", "cfr",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-colorspace", "bt709",
    "-movflags", "+faststart",
    opts.outPath
  ];
}

function assemble(opts) {
  /*
   * Werkzeug vor Daten: fehlt ffmpeg, ist die Frames-Prüfung die falsche
   * Fehlermeldung — der Lauf kann so oder so nicht erfolgreich sein.
   */
  if (!fs.existsSync(opts.ffmpeg)) fail("ffmpeg nicht gefunden: " + opts.ffmpeg);
  if (!fs.existsSync(opts.ffprobe)) fail("ffprobe nicht gefunden: " + opts.ffprobe);
  const framesDir = resolvePipelinePath(opts.frames);
  if (!fs.existsSync(framesDir)) fail("Frames-Verzeichnis fehlt: " + framesDir);
  const manifest = readFrameManifest(framesDir);
  const outPath = resolvePipelinePath(opts.out);
  const encode = Object.assign({}, opts, {
    fps: manifest.fps,
    totalFrames: manifest.totalFrames,
    outPath: outPath
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  /* Abbruch, falscher Codec, halbe Datei: es darf kein Clip zurückbleiben. */
  if (fs.existsSync(outPath)) fs.rmSync(outPath, { force: true });

  const started = Date.now();
  runner.encodeVideo(opts.ffmpeg, ffmpegArgs(encode, framesDir));
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    fail("ffmpeg meldete Erfolg, aber " + opts.out + " fehlt oder ist leer.");
  }
  return { manifest: manifest, outPath: outPath, encodeMs: Date.now() - started };
}
/*
 * ffprobe ist der Beweis: nur was messbar stimmt, gilt als fertig.
 * Bewusst ohne Seiteneffekte — die Auswertung ist dadurch mit
 * erfundenen ffprobe-Antworten pruefbar.
 */
function verifyVideo(probe, manifest, outPath) {
  const stream = runner.firstStream(probe, "video");
  if (!stream) fail("ffprobe hat im Clip keinen Videostream gefunden.");
  if (runner.firstStream(probe, "audio")) fail("Clip darf keine Tonspur enthalten.");
  if (stream.codec_name !== "h264") fail("Videocodec ist " + stream.codec_name + ", erwartet h264.");
  if (stream.pix_fmt !== "yuv420p") fail("Pixelformat ist " + stream.pix_fmt + ", erwartet yuv420p.");
  if (stream.width !== 1080 || stream.height !== 1920) {
    fail("Clip ist " + stream.width + "x" + stream.height + ", erwartet 1080x1920.");
  }
  const avgFps = runner.parseRate(stream.avg_frame_rate);
  const realFps = runner.parseRate(stream.r_frame_rate);
  if (Math.abs(avgFps - manifest.fps) > 0.01 || Math.abs(realFps - manifest.fps) > 0.01) {
    fail("Clip läuft mit " + runner.round2(avgFps) + "/" + runner.round2(realFps)
      + " fps, erwartet " + manifest.fps + ".");
  }
  const frameCount = Number(stream.nb_frames || 0);
  if (frameCount !== manifest.totalFrames) {
    fail("Clip enthält " + frameCount + " Bilder, Framesatz hat " + manifest.totalFrames + ".");
  }
  const expectedSeconds = manifest.totalFrames / manifest.fps;
  const seconds = Number(probe.format && probe.format.duration);
  if (!Number.isFinite(seconds) || Math.abs(seconds - expectedSeconds) > 0.05) {
    fail("Clip dauert " + runner.round2(seconds) + "s, erwartet " + runner.round2(expectedSeconds) + "s.");
  }
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    fail("Clip muss " + MIN_SECONDS + "–" + MAX_SECONDS + "s dauern, ist " + runner.round2(seconds) + "s.");
  }
  const bytes = fs.statSync(outPath).size;
  if (bytes < MIN_BYTES) {
    fail("Clip ist verdächtig klein (" + bytes + " Bytes) — vermutlich stammen keine Bilder daraus.");
  }
  return { stream: stream, frameCount: frameCount, seconds: runner.round2(seconds), bytes: bytes };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) return;
  const done = assemble(opts);
  const probe = runner.probeVideo(opts.ffprobe, done.outPath);
  const verified = verifyVideo(probe, done.manifest, done.outPath);
  const stream = verified.stream;
  const report = {
    schemaVersion: 1,
    video: scene.reportPath(done.outPath),
    bytes: verified.bytes,
    codec: stream.codec_name,
    profile: stream.profile,
    pixFmt: stream.pix_fmt,
    width: stream.width,
    height: stream.height,
    aspect: "9:16",
    fps: done.manifest.fps,
    frameCount: verified.frameCount,
    durationSeconds: verified.seconds,
    audio: false,
    crf: opts.crf,
    preset: opts.preset,
    sourceFramesDir: scene.reportPath(opts.frames),
    sourceFrameSetSha256: done.manifest.frameSetSha256,
    encodeMs: done.encodeMs
  };
  const reportPath = path.join(path.dirname(done.outPath), REPORT_NAME);
  writeAtomic(reportPath, JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify({
    video: report.video,
    bytes: report.bytes,
    codec: report.codec,
    resolution: report.width + "x" + report.height,
    aspect: report.aspect,
    fps: report.fps,
    frameCount: report.frameCount,
    durationSeconds: report.durationSeconds,
    audio: report.audio,
    sourceFrameSetSha256: report.sourceFrameSetSha256,
    report: scene.reportPath(reportPath)
  }, null, 2) + "\n");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write("FEHLER: " + (error && error.message ? error.message : String(error)) + "\n");
    process.exit(1);
  }
}

module.exports = {
  parseArgs: parseArgs,
  readFrameManifest: readFrameManifest,
  ffmpegArgs: ffmpegArgs,
  verifyVideo: verifyVideo,
  MIN_SECONDS: MIN_SECONDS,
  MAX_SECONDS: MAX_SECONDS
};
