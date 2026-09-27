#!/usr/bin/env node
"use strict";

/*
 * P7.3.5 — Gegenprobe am fertigen Clip.
 * Die Stichproben werden nicht aus den PNGs gelesen, sondern von ffmpeg neu
 * dekodiert. Damit ist belegt, was wirklich im MP4 steckt: Auflösung,
 * Bildrate, Seitenverhältnis und die drei abnahme-relevanten Momente
 * (Hook, Lösung, Endcard) werden gegen die Zeitachse geprüft.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const probe = require("./lib/png-probe");
const runner = require("./lib/ffmpeg-runner");
const timeline = require("./lib/timeline");
const scene = require("./lib/isolated-scene");

const fail = scene.fail;
const resolvePipelinePath = scene.resolvePipelinePath;
const STAGE_WIDTH = timeline.STAGE_WIDTH;
const STAGE_HEIGHT = timeline.STAGE_HEIGHT;
const SAMPLE_STEP = 24;

function usage() {
  return [
    "Verwendung: node content-pipeline/verify-clip.js [Optionen]",
    "",
    "  --clip <datei.mp4>      Fertiger Clip (Standard: content-pipeline/work/video/clip.mp4)",
    "  --frames <verzeichnis>  Quellframes; damit wird der Clip gegen die gerenderten Bilder geprueft",
    "  --hook <name>           Hook-Vorlage des Clips; ohne Angabe steht sie im Frame-Manifest",
    "  --probe-every <n>      Zusätzliche Stichproben alle n Frames (Standard: 30)",
    "  --step <n>             Messraster der Schwarzprüfung (Standard: 24)",
    "  --ffmpeg <pfad>        Expliziter ffmpeg-Pfad",
    "  --help                 Diese Hilfe anzeigen"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = {
    clip: "content-pipeline/work/video/clip.mp4",
    frames: "",
    hook: "",
    probeEvery: 30,
    step: SAMPLE_STEP,
    ffmpeg: runner.findFfmpeg()
  };
  const known = ["--clip", "--frames", "--hook", "--probe-every", "--step", "--ffmpeg"];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (!known.includes(arg)) fail("Unbekannte Option: " + arg + "\n\n" + usage());
    if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
    const value = argv[++i];
    if (arg === "--clip") opts.clip = value;
    if (arg === "--frames") opts.frames = value;
    if (arg === "--hook") opts.hook = value;
    if (arg === "--probe-every") opts.probeEvery = Number(value);
    if (arg === "--step") opts.step = Number(value);
    if (arg === "--ffmpeg") opts.ffmpeg = value;
  }
  if (!opts.ffmpeg) fail("Kein ffmpeg gefunden. Setze FFMPEG_PATH oder --ffmpeg.");
  if (!opts.clip.trim()) fail("Clip-Pfad darf nicht leer sein.");
  if (!Number.isInteger(opts.probeEvery) || opts.probeEvery < 1) {
    fail("Stichprobenabstand muss mindestens 1 sein.");
  }
  if (!Number.isInteger(opts.step) || opts.step < 1) {
    fail("Messraster muss mindestens 1 sein.");
  }
  return opts;
}

/*
 * Die Stichproben decken die abnahme-relevanten Momente ab: Hook, Reveal-
 * Anfang und -Ende, Denkpause, Auflösung, Endcard-Anfang und letzter Frame.
 * Zusätzlich wird in gleichmäßigem Abstand gemessen, damit ein Aussetzer
 * mitten im Reveal nicht unbemerkt bleibt.
 */
function sampleFrames(plan, probeEvery) {
  const picks = new Set();
  /*
   * P7.4.3 — Die Stichproben werden ueber Segment-IDs gewählt, nicht ueber
   * feste Indizes: die Vorher/Nachher-Vorlage hat ein Segment mehr, und ein
   * Index 3 waere dort die Denkpause statt der Aufloesung.
   */
  ["hook", "vorher", "reveal", "pause", "solution", "endcard"].forEach(function (id) {
    const segment = plan.segments.find(function (entry) { return entry.id === id; });
    if (segment) picks.add(segment.fromFrame);
  });
  [plan.segments[1], plan.segments[plan.segments.length - 2]].forEach(function (segment) {
    if (segment) picks.add(segment.toFrame);
  });
  picks.add(plan.totalFrames - 1);

  for (let frame = 0; frame < plan.totalFrames; frame += probeEvery) picks.add(frame);
  return Array.from(picks).filter(function (frame) {
    return frame >= 0 && frame < plan.totalFrames;
  }).sort(function (a, b) { return a - b; });
}
/*
 * Erwartungen je Segment. Sie halten fest, was 7.3.5 verlangt: lesbarer
 * Hook, sichtbare Lösung, Endcard am Ende — und die 2-Sekunden-Denkpause
 * genau vor der Auflösung.
 */
const SEGMENT_RULES = {
  hook: { solutionVisible: false, endcardVisible: false },
  /* P7.4.3 — der Schulweg vor dem Blueprint: noch keine Loesung, Endcard aus. */
  vorher: { solutionVisible: false, endcardVisible: false },
  reveal: { solutionVisible: false, endcardVisible: false },
  pause: { solutionVisible: false, endcardVisible: false },
  solution: { solutionVisible: true, endcardVisible: false },
  endcard: { solutionVisible: true, endcardVisible: true }
};

/*
 * Vergleicht den dekodierten Clip-Frame mit dem Quell-PNG desselben Frames.
 * h264 ist verlustbehaftet, deshalb zaehlt die mittlere Abweichung je Kanal;
 * erst ein deutlich sichtbarer Unterschied wertet als Fehler. Damit wird ein
 * Clip sichtbar, der zwar 1080x1920 traegt, aber ein anderes Bild zeigt.
 */
function meanDifference(image, source) {
  if (!source) return null;
  if (source.width !== image.width || source.height !== image.height) return null;
  let total = 0;
  let samples = 0;
  for (let y = 0; y < image.height; y += 4) {
    for (let x = 0; x < image.width; x += 4) {
      const a = probe.colorAt(image, x, y);
      const b = probe.colorAt(source, x, y);
      total += Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      samples += 3;
    }
  }
  return samples ? total / samples : null;
}

const MAX_MEAN_DIFFERENCE = 3;

function checkFrame(plan, frame, image, measured, sourceImage) {
  /* Bytes oder Bildobjekt werden genau einmal hier aufgelöst. */
  const decoded = Buffer.isBuffer(image) ? probe.decodePng(image) : image;
  const result = probe.probeFrame(decoded, { step: SAMPLE_STEP });
  const source = Buffer.isBuffer(sourceImage) ? probe.decodePng(sourceImage) : sourceImage;
  const state = timeline.frameState(plan, frame);
  const rule = SEGMENT_RULES[state.segment];
  const problems = [];
  if (result.width !== STAGE_WIDTH || result.height !== STAGE_HEIGHT) {
    problems.push("Auflösung " + result.width + "x" + result.height);
  }
  if (result.black > 0) problems.push(result.black + " schwarze Stichproben");
  if (result.blackCorners > 0) problems.push(result.blackCorners + " schwarze Ecken");
  if (result.blackEdges.length > 0) problems.push("schwarze Ränder: " + result.blackEdges.join(", "));
  if (!rule) {
    problems.push("unbekanntes Segment " + state.segment);
    return { state: state, result: result, problems: problems };
  }
  /*
   * 7.3.5 — Die Sollregeln gelten fuer den gemessenen Zustand, nicht nur
   * fuer die Planung. Die Buehne liefert beim Rendern zurueck, was sie
   * tatsaechlich zeigt; stimmt das nicht mit dem Segment ueberein, ist der
   * Clip an dieser Stelle falsch, auch wenn die Geometrie sauber ist.
   */
  if (measured) {
    if (typeof measured.solutionVisible === "boolean" && measured.solutionVisible !== rule.solutionVisible) {
      problems.push("Aufloesung ist sichtbar=" + measured.solutionVisible
        + ", im Segment " + state.segment + " muss sie sichtbar=" + rule.solutionVisible + " sein");
    }
    if (typeof measured.endcardVisible === "boolean" && measured.endcardVisible !== rule.endcardVisible) {
      problems.push("Endcard ist sichtbar=" + measured.endcardVisible
        + ", im Segment " + state.segment + " muss sie sichtbar=" + rule.endcardVisible + " sein");
    }
  }
  /* Der Clip muss tatsaechlich das gerenderte Bild zeigen. */
  const difference = meanDifference(decoded, source);
  if (difference !== null && difference > MAX_MEAN_DIFFERENCE) {
    problems.push("Clip-Frame weicht vom Quellframe ab (Mittel " + difference.toFixed(2) + ")");
  }
  return { state: state, result: result, problems: problems, difference: difference };
}

function extractFrame(ffmpegPath, clipPath, frame, outPath) {
  runner.encodeVideo(ffmpegPath, [
    "-v", "error", "-i", clipPath,
    "-vf", "select=eq(n\\," + frame + ")",
    "-fps_mode", "passthrough", "-frames:v", "1", "-y", outPath
  ]);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const clipPath = resolvePipelinePath(opts.clip);
  if (!fs.existsSync(clipPath)) {
    fail("Clip fehlt: " + opts.clip + " — bitte zuerst assemble-video.js ausführen.");
  }

  /*
   * Mit --frames kommt der gemessene Buehnenzustand aus dem Manifest der
   * Renderstufe dazu. Er ist die Grundlage der Segmentpruefung: die
   * Zeitachse sagt, was sein soll, das Manifest sagt, was wirklich war.
   */
  const framesDir = opts.frames ? resolvePipelinePath(opts.frames) : null;
  let measuredByFrame = null;
  /*
   * P7.4.1 — Die Hook-Vorlage steht im Frame-Manifest und wird hier einmalig
   * mitgelesen. Die Gegenprobe darf sie nicht raten: sonst prueft sie einen
   * 19-s-Clip an einer 16-s-Achse und meldet jeden Frame nach dem Reveal als
   * falsch. Ohne --frames bleibt sie leer und es gilt der Standardablauf.
   */
  let hookId = "";
  if (framesDir) {
    const manifestPath = path.join(framesDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      fail("Kein manifest.json in " + opts.frames + " — erst mit render-frames.js rendern.");
    }
    let stored;
    try {
      stored = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (error) {
      fail("Frame-Manifest ist unlesbar: " + error.message);
    }
    hookId = stored.hook || "";
    measuredByFrame = {};
    stored.frames.forEach(function (entry) {
      measuredByFrame[entry.frame] = entry;
    });
  }

  if (opts.hook) {
    if (hookId && opts.hook !== hookId) {
      fail("Geprüft wird --hook " + opts.hook + ", gerendert wurde " + hookId + ".");
    }
    hookId = opts.hook;
  }

  const plan = timeline.buildTimeline(undefined, hookId || timeline.DEFAULT_HOOK);
  const frames = sampleFrames(plan, opts.probeEvery);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-clipcheck-"));
  const findings = [];
  try {
    frames.forEach(function (frame) {
      const out = path.join(dir, "f" + String(frame).padStart(4, "0") + ".png");
      extractFrame(opts.ffmpeg, clipPath, frame, out);
      if (!fs.existsSync(out)) fail("Frame " + frame + " liess sich aus dem Clip nicht dekodieren.");

      /* Gemessener Buehnenzustand und Quell-PNG kommen aus dem Framesatz. */
      const measured = measuredByFrame ? measuredByFrame[frame] : null;
      if (measuredByFrame && !measured) {
        fail("Frame " + frame + " fehlt im Frame-Manifest — Framesatz und Clip passen nicht zusammen.");
      }
      /*
       * Der Quellframe wird dekodiert, nicht nur gelesen: meanDifference
       * vergleicht Pixel und braucht daher das Bildobjekt.
       */
      let sourceImage = null;
      if (measured) {
        const source = path.join(framesDir, measured.file);
        if (!fs.existsSync(source)) {
          fail("Quellframe fehlt: " + measured.file + " — Framesatz unvollständig.");
        }
        sourceImage = probe.decodePng(fs.readFileSync(source));
      }

      /*
       * Einmal dekodieren und das Bildobjekt weitergeben: probeFrame und
       * meanDifference arbeiten beide auf dem dekodierten Bild, nicht auf
       * den PNG-Bytes.
       */
      const clipImage = probe.decodePng(fs.readFileSync(out));
      const check = checkFrame(plan, frame, clipImage, measured, sourceImage);
      findings.push(check);
      process.stdout.write(
        "frame " + String(frame).padStart(3) + " " + check.state.segment.padEnd(8)
        + " reveal=" + check.state.revealProgress.toFixed(2)
        + " solution=" + check.state.solutionProgress.toFixed(2)
        + " endcard=" + (check.state.endcardVisible ? "ja" : "nein")
        + "  " + check.result.width + "x" + check.result.height
        + (check.difference === null ? "" : "  delta=" + check.difference.toFixed(2))
        + "  " + (check.problems.length ? "FEHLER " + check.problems.join("; ") : "OK") + "\n");
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const faulty = findings.filter(function (entry) { return entry.problems.length > 0; });
  /* Die Endcard muss am Ende stehen und sichtbar sein. */
  const last = findings[findings.length - 1];
  if (!last.state.endcardVisible) {
    fail("Der letzte Clip-Frame zeigt keine Endcard — der Clip endet nicht mit der Marke.");
  }
  /*
   * P7.4.3 — Die Endcard-Dauer wird ueber ihre Segment-ID gemessen, nicht
   * ueber einen festen Index: die Vorher/Nachher-Vorlage hat ein Segment mehr,
   * und Index 4 waere dort die Aufloesung. Das ergaebe eine Endcard von ~7 s
   * und wuerde einen voellig korrekten Clip als zu lang abweisen.
   */
  const endcardSegment = plan.segments.find(function (entry) { return entry.id === "endcard"; });
  if (!endcardSegment) fail("Die Zeitachse hat kein Endcard-Segment.");
  const endcardSeconds = (last.state.timeMs - endcardSegment.fromTimeMs) / 1000;
  if (endcardSeconds < 2 || endcardSeconds > 3) {
    fail("Die Endcard muss 2–3 s dauern, gemessen sind " + endcardSeconds.toFixed(2) + " s.");
  }

  process.stdout.write(faulty.length
    ? "CLIP_CHECK_FEHLER (" + faulty.length + " auffaellige Frames)\n"
    : "CLIP_CHECK_OK (" + findings.length + " Clip-Frames geprueft, Endcard "
      + endcardSeconds.toFixed(1) + " s)\n");
  if (faulty.length) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write("FEHLER: " + (error && error.message ? error.message : String(error)) + "\n");
    if (process.env.P7_DEBUG) process.stderr.write(String(error && error.stack) + "\n");
    process.exit(1);
  }
}

module.exports = {
  parseArgs: parseArgs,
  sampleFrames: sampleFrames,
  checkFrame: checkFrame,
  SEGMENT_RULES: SEGMENT_RULES
};
