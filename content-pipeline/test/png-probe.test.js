#!/usr/bin/env node
"use strict";


// @block frontend — Frontend-Struktur: Preview/Renderer duerfen app-active.js nicht einbinden
// Blockzuordnung: siehe test/runs.js (node test/runs.js --bloecke)
/*
 * P7.3.3 — PNG-Leser der Frame-Prüfung.
 * Geprüft wird, dass Renderer-Frames als 1080x1920 erkannt werden und
 * Schwarzflächen zuverlässig auffallen. Grundlage sind selbst gebaute
 * PNGs, damit der Test ohne Browser und ohne Zusatzmodul läuft.
 */


const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const png = require("../lib/png-probe");

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

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const payload = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([length, payload, crc]);
}

/* Baut ein RGB-PNG aus einer Funktion, die je Pixel eine Farbe liefert. */
function buildPng(width, height, colorAt) {
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
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const CREAM = [253, 246, 231];
const BLACK = [0, 0, 0];

/* 1 — Auflösung und Pixelwerte stimmen exakt. */
function testDecode() {
  const image = png.decodePng(buildPng(4, 3, function (x, y) {
    return x === y ? BLACK : CREAM;
  }));
  assert.equal(image.width, 4);
  assert.equal(image.height, 3);
  assert.equal(image.rgba.length, 4 * 3 * 4);
  assert.deepEqual(png.colorAt(image, 0, 0), { r: 0, g: 0, b: 0, a: 255 });
  assert.deepEqual(png.colorAt(image, 3, 2), { r: 253, g: 246, b: 231, a: 255 });
  assert.equal(png.colorAt(image, 1, 1).r, 0, "Diagonale muss schwarz sein");
}

/* 2 — Alle Zeilenfilter werden korrekt zurückgerechnet. */
function testUnfilter() {
  const width = 5;
  const height = 4;
  const colors = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) colors.push([(x * 20) % 256, (y * 30) % 256, 128]);
  }
  const sub = Buffer.alloc((width * 3 + 1) * height);
  const up = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    sub[rowStart] = 1;
    up[rowStart] = 2;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colors[y * width + x];
      const [pr, pg, pb] = x > 0 ? colors[y * width + x - 1] : [0, 0, 0];
      const [ur, ug, ub] = y > 0 ? colors[(y - 1) * width + x] : [0, 0, 0];
      sub[rowStart + 1 + x * 3] = (r - pr) & 0xff;
      sub[rowStart + 2 + x * 3] = (g - pg) & 0xff;
      sub[rowStart + 3 + x * 3] = (b - pb) & 0xff;
      up[rowStart + 1 + x * 3] = (r - ur) & 0xff;
      up[rowStart + 2 + x * 3] = (g - ug) & 0xff;
      up[rowStart + 3 + x * 3] = (b - ub) & 0xff;
    }
  }
  assert.deepEqual(png.unfilter(sub, width, height, 3), png.unfilter(up, width, height, 3));

  const none = Buffer.alloc((width * 3 + 1) * height);
  const expected = Buffer.alloc(width * 3 * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    none[rowStart] = 0;
    for (let x = 0; x < width * 3; x += 1) {
      none[rowStart + 1 + x] = (x * 7) % 256;
      expected[y * width * 3 + x] = (x * 7) % 256;
    }
  }
  assert.deepEqual(png.unfilter(none, width, height, 3), expected, "Filter 0 muss unverändert übernehmen");
  assert.throws(function () { png.unfilter(Buffer.from([9, 0, 0]), 1, 1, 3); }, /Zeilenfilter/);
}

/* 3 — Schwarzmessung erkennt Ränder, Ecken und Flächen. */
function testBlackProbe() {
  const clean = png.probeFrame(buildPng(40, 60, function () { return CREAM; }), { step: 4 });
  assert.equal(clean.width, 40);
  assert.equal(clean.height, 60);
  assert.equal(clean.black, 0);
  assert.equal(clean.blackRatio, 0);
  assert.equal(clean.blackCorners, 0);
  assert.deepEqual(clean.blackEdges, []);
  assert.equal(clean.sampled, 10 * 15);

  const blackCorners = png.probeFrame(buildPng(40, 60, function (x, y) {
    return (x === 0 || x === 39) && (y === 0 || y === 59) ? BLACK : CREAM;
  }), { step: 4 });
  assert.equal(blackCorners.blackCorners, 4, "alle vier Ecken müssen als schwarz gelten");
  assert.equal(blackCorners.blackEdges.length, 0, "nur die Ecken, nicht die ganze Randlinie");

  const blackBorder = png.probeFrame(buildPng(40, 60, function (x, y) {
    return x < 2 || x > 37 || y < 2 || y > 57 ? BLACK : CREAM;
  }), { step: 4 });
  assert.equal(blackBorder.blackCorners, 4);
  assert.equal(blackBorder.blackEdges.length, 4, "geschlossener schwarzer Rand muss auffallen");

  const blackHalf = png.probeFrame(buildPng(40, 60, function (x) {
    return x < 20 ? BLACK : CREAM;
  }), { step: 4 });
  assert.ok(blackHalf.blackRatio > 0.45, "schwarze Hälfte muss den Anteil deutlich heben");
  assert.equal(blackHalf.blackCorners, 2, "nur die linken Ecken liegen im schwarzen Bereich");
  assert.deepEqual(blackHalf.blackEdges, ["left"], "nur der linke Rand ist schwarz");

  const nearBlack = png.probeFrame(buildPng(8, 8, function () { return [4, 4, 4]; }), { step: 2 });
  assert.equal(nearBlack.black, nearBlack.sampled, "Werte bis zum Schwellwert zählen als schwarz");
  const dark = png.probeFrame(buildPng(8, 8, function () { return [40, 44, 52]; }), { step: 2 });
  assert.equal(dark.black, 0, "dunkles Blau der App ist kein Schwarzdefekt");
  assert.equal(png.isBlack({ r: 0, g: 0, b: 0, a: 0 }, 6), false, "vollständig durchsichtig ist kein Schwarz");
}

/* 4 — Fremde oder kaputte Dateien müssen klar scheitern. */
function testInvalidPng() {
  assert.throws(function () { png.decodePng(Buffer.from("kein PNG")); }, /keine PNG/);
  assert.throws(function () { png.decodePng(null); }, /keine PNG/);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header[8] = 16;
  header[9] = 2;
  assert.throws(function () {
    png.decodePng(Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header)
    ]));
  }, /8 Bit/);
}

const tests = [
  testDecode,
  testUnfilter,
  testBlackProbe,
  testInvalidPng
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
process.stdout.write("PNG_PROBE_OK (" + tests.length + " Tests)\n");
