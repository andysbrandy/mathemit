#!/usr/bin/env node
"use strict";

/*
 * P7.3.3 — Minimaler PNG-Leser für die Frame-Prüfung.
 * Nur vom Renderer erzeugte Screenshots (8 Bit, nicht interlaced) werden
 * unterstützt; dafür braucht die Pipeline keine weitere Abhängigkeit.
 */

const zlib = require("node:zlib");

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function fail(message) {
  const error = new Error(message);
  error.code = "P7_PNG";
  throw error;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(raw, width, height, channels) {
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source];
    source += 1;
    const rowStart = y * stride;
    const prevStart = rowStart - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source + x];
      const left = x >= channels ? out[rowStart + x - channels] : 0;
      const up = y > 0 ? out[prevStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? out[prevStart + x - channels] : 0;
      let restored;
      if (filter === 0) restored = value;
      else if (filter === 1) restored = value + left;
      else if (filter === 2) restored = value + up;
      else if (filter === 3) restored = value + Math.floor((left + up) / 2);
      else if (filter === 4) restored = value + paeth(left, up, upLeft);
      else fail("Unbekannter PNG-Zeilenfilter: " + filter);
      out[rowStart + x] = restored & 0xff;
    }
    source += stride;
  }
  return out;
}


/* Liefert Breite, Höhe und RGBA-Pixel (ein Byte je Kanal). */
function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || !buffer.slice(0, 8).equals(SIGNATURE)) {
    fail("Datei ist keine PNG.");
  }
  let offset = 8;
  let header = null;
  let palette = null;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString("ascii");
    const body = buffer.slice(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12]
      };
    } else if (type === "PLTE") {
      palette = body;
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
  }
  if (!header) fail("PNG ohne Bildkopf.");
  if (header.depth !== 8) fail("PNG muss 8 Bit pro Kanal haben (hat " + header.depth + ").");
  if (header.interlace !== 0) fail("Interlaced PNG wird nicht unterstützt.");
  if (!CHANNELS[header.colorType]) fail("Unbekannter PNG-Farbtyp: " + header.colorType);
  if (!idat.length) fail("PNG ohne Bilddaten.");
  if (header.colorType === 3 && !palette) fail("PNG mit Farbtabelle ohne PLTE.");

  const channels = CHANNELS[header.colorType];
  const raw = unfilter(zlib.inflateSync(Buffer.concat(idat)), header.width, header.height, channels);
  const count = header.width * header.height;
  const rgba = Buffer.alloc(count * 4);
  for (let index = 0; index < count; index += 1) {
    const source = index * channels;
    const target = index * 4;
    if (header.colorType === 6) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source + 1];
      rgba[target + 2] = raw[source + 2];
      rgba[target + 3] = raw[source + 3];
    } else if (header.colorType === 2) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source + 1];
      rgba[target + 2] = raw[source + 2];
      rgba[target + 3] = 255;
    } else if (header.colorType === 0) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source];
      rgba[target + 2] = raw[source];
      rgba[target + 3] = 255;
    } else if (header.colorType === 4) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source];
      rgba[target + 2] = raw[source];
      rgba[target + 3] = raw[source + 1];
    } else {
      const entry = raw[source] * 3;
      rgba[target] = palette[entry];
      rgba[target + 1] = palette[entry + 1];
      rgba[target + 2] = palette[entry + 2];
      rgba[target + 3] = 255;
    }
  }
  return { width: header.width, height: header.height, rgba: rgba };
}


function colorAt(image, x, y) {
  const target = (y * image.width + x) * 4;
  return { r: image.rgba[target], g: image.rgba[target + 1], b: image.rgba[target + 2], a: image.rgba[target + 3] };
}

function isBlack(color, threshold) {
  return color.a > 0 && color.r <= threshold && color.g <= threshold && color.b <= threshold;
}

/*
 * Prüft einen Frame auf schwarze Randstreifen und schwarze Flächen.
 * Gerasterte Stichprobe statt Vollfläche: schnell und für eine
 * Schwarzflächen-Kontrolle eindeutig genug.
 */
function probeFrame(buffer, options) {
  const opts = options || {};
  const threshold = opts.blackThreshold === undefined ? 6 : opts.blackThreshold;
  const step = Math.max(1, opts.step || 8);
  /* Erlaubt sowohl PNG-Bytes als auch ein bereits dekodiertes Bild. */
  const image = Buffer.isBuffer(buffer) ? decodePng(buffer) : buffer;
  if (!image || !image.rgba) fail("probeFrame braucht PNG-Bytes oder ein dekodiertes Bild.");
  const midX = Math.floor(image.width / 2);
  const midY = Math.floor(image.height / 2);

  const corners = [
    colorAt(image, 0, 0),
    colorAt(image, image.width - 1, 0),
    colorAt(image, 0, image.height - 1),
    colorAt(image, image.width - 1, image.height - 1)
  ];
  const edges = {
    top: colorAt(image, midX, 0),
    bottom: colorAt(image, midX, image.height - 1),
    left: colorAt(image, 0, midY),
    right: colorAt(image, image.width - 1, midY)
  };

  let sampled = 0;
  let black = 0;
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      sampled += 1;
      if (isBlack(colorAt(image, x, y), threshold)) black += 1;
    }
  }
  return {
    width: image.width,
    height: image.height,
    sampled: sampled,
    black: black,
    blackRatio: sampled ? Math.round(black / sampled * 1e4) / 1e4 : 0,
    blackCorners: corners.filter(function (color) { return isBlack(color, threshold); }).length,
    blackEdges: Object.keys(edges).filter(function (key) { return isBlack(edges[key], threshold); })
  };
}

module.exports = {
  fail: fail,
  unfilter: unfilter,
  decodePng: decodePng,
  colorAt: colorAt,
  isBlack: isBlack,
  probeFrame: probeFrame
};
