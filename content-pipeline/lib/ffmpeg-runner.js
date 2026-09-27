const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

/*
 * P7.3.4 — ffmpeg/ffprobe-Anbindung der Video-Montage.
 * Ausschliesslich lokale Binaries, keine Netzwerkzugriffe. Jeder Fehler
 * von ffmpeg oder ffprobe bricht den Lauf ab, damit kein halbfertiges
 * Video als Ergebnis durchgeht.
 */

const FFMPEG_PATHS = [
  process.env.FFMPEG_PATH,
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/usr/bin/ffmpeg"
];
const FFPROBE_PATHS = [
  process.env.FFPROBE_PATH,
  "/opt/homebrew/bin/ffprobe",
  "/usr/local/bin/ffprobe",
  "/usr/bin/ffprobe"
];

function fail(message) {
  const error = new Error(message);
  error.code = "P7_FFMPEG";
  throw error;
}

function firstExisting(candidates) {
  return candidates.find(function (candidate) {
    return candidate && fs.existsSync(candidate);
  }) || null;
}

function findFfmpeg() {
  return firstExisting(FFMPEG_PATHS);
}

function findFfprobe() {
  return firstExisting(FFPROBE_PATHS);
}

/* Führt ein Binär aus; ein Exitcode ungleich 0 ist immer ein Abbruchgrund. */
function runTool(binary, args, label) {
  const result = spawnSync(binary, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    fail(label + " konnte nicht gestartet werden (" + binary + "): " + result.error.message);
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || "").trim().split("\n").slice(-6).join(" | ");
    fail(label + " ist mit Code " + result.status + " fehlgeschlagen: " + (detail || "ohne Ausgabe"));
  }
  return String(result.stdout || "");
}

function encodeVideo(ffmpegPath, args) {
  runTool(ffmpegPath, args, "ffmpeg");
}

/*
 * Liest die technischen Eckdaten aus. ffmpeg liefert die Eckdaten als JSON;
 * fehlt der Ton (stummer Clip ohne Tonspur), wird das später gemeldet.
 */
function probeVideo(ffprobePath, filePath) {
  const stdout = runTool(ffprobePath, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath
  ], "ffprobe");
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (error) {
    fail("ffprobe lieferte keine gültigen JSON-Eckdaten: " + error.message);
  }
  if (!data || !Array.isArray(data.streams) || !data.format) {
    fail("ffprobe lieferte keine auswertbaren Streams oder Formatangaben.");
  }
  return data;
}

function firstStream(data, kind) {
  return data.streams.find(function (stream) { return stream.codec_type === kind; }) || null;
}

/* Bildrate als Bruch, z. B. "30/1" — ohne Gleitkommavergleich. */
function parseRate(value) {
  const match = /^(\d+)\/(\d+)$/.exec(String(value || ""));
  if (!match) return NaN;
  return Number(match[1]) / Number(match[2]);
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

module.exports = {
  fail: fail,
  findFfmpeg: findFfmpeg,
  findFfprobe: findFfprobe,
  runTool: runTool,
  encodeVideo: encodeVideo,
  probeVideo: probeVideo,
  firstStream: firstStream,
  parseRate: parseRate,
  round2: round2
};
