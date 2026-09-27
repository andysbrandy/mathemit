#!/usr/bin/env node
"use strict";

/*
 * P7.3.3 — Deterministisches 9:16-Rendering.
 * Feste 1080x1920-Buehne, feste Kamera, feste Bildrate: gleiche Eingabe
 * ergibt gleiche Frames. Kein Backend, kein Storage, kein Netzwerk.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const scene = require("./lib/isolated-scene");
const timeline = require("./lib/timeline");
const png = require("./lib/png-probe");

const DEFAULT_EPISODE = "content-pipeline/work/episode.json";
const DEFAULT_FRAMES_DIR = "content-pipeline/work/frames";
const DEFAULT_TIMEOUT_MS = 30000;
const STAGE_TEMPLATE = "preview/stage-916.html";
const MANIFEST_NAME = "manifest.json";
const PAUSE_SEGMENT = "pause";
const SOLUTION_SEGMENT = "solution";
const ENDCARD_SEGMENT = "endcard";
const MIN_PAUSE_MS = 2000;
const MIN_ENDCARD_SECONDS = 2;
const MAX_ENDCARD_SECONDS = 3;
/* Randlos: das Zeichen muss die volle Buehnenbreite belegen (mit Rand zaehlt es als zu klein). */
const MIN_LOGO_FILL = 0.99;
const MAX_BLACK_RATIO = 0.02;

const STAGE_WIDTH = timeline.STAGE_WIDTH;
const STAGE_HEIGHT = timeline.STAGE_HEIGHT;
const REPO_ROOT = scene.REPO_ROOT;
const fail = scene.fail;
const findChrome = scene.findChrome;
const resolvePipelinePath = scene.resolvePipelinePath;
const readEpisode = scene.readEpisode;
const buildDocument = scene.buildDocument;
const writeAtomic = scene.writeAtomic;
const sleep = scene.sleep;
const startIsolatedScene = scene.startIsolatedScene;
const closeIsolatedScene = scene.closeIsolatedScene;
const assertNoSceneErrors = scene.assertNoSceneErrors;
const buildTimeline = timeline.buildTimeline;
const frameState = timeline.frameState;
const segmentAt = timeline.segmentAt;
const segmentById = timeline.segmentById;

function usage() {
  return [
    "Verwendung: node content-pipeline/render-frames.js [Optionen]",
    "",
    "  --episode <datei.json>  Aufgaben-Episode (Standard: " + DEFAULT_EPISODE + ")",
    "  --index <0|1|2|3|4>    Aufgabe aus der Episode (Standard: 0)",
    "  --out <verzeichnis>    Zielordner für Frames und Manifest",
    "  --fps <1–60>           Bildrate (Standard: " + timeline.DEFAULT_FPS + ")",
    "  --probe-every <n>      Schwarzwert-Stichprobe alle n Frames (Standard: 30)",
    "  --limit-frames <n>      Nur die ersten n Frames rendern (Prüflauf, Ergebnis ist unvollständig)",
    "  --segment <id>          Nur ein Segment rendern (hook|reveal|pause|solution|endcard)",
    "  --hook <name>           Hook-Vorlage: " + timeline.HOOK_IDS.join(" | ")
      + " (Standard: " + timeline.DEFAULT_HOOK + ")",
    "  --chrome <pfad>        Expliziter Chrome-/Chromium-Pfad",
    "  --timeout <ms>         Browser-Timeout (Standard: " + DEFAULT_TIMEOUT_MS + ")",
    "  --help                 Diese Hilfe anzeigen"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = {
    episode: DEFAULT_EPISODE,
    index: 0,
    out: DEFAULT_FRAMES_DIR,
    fps: timeline.DEFAULT_FPS,
    probeEvery: 30,
    limitFrames: 0,
    segment: "",
    hook: timeline.DEFAULT_HOOK,
    chrome: findChrome(),
    timeout: DEFAULT_TIMEOUT_MS
  };
  const known = ["--episode", "--index", "--out", "--fps", "--probe-every", "--limit-frames", "--segment", "--hook", "--chrome", "--timeout"];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (!known.includes(arg)) fail("Unbekannte Option: " + arg + "\n\n" + usage());
    if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
    const value = argv[++i];
    if (arg === "--episode") opts.episode = value;
    if (arg === "--index") opts.index = Number(value);
    if (arg === "--out") opts.out = value;
    if (arg === "--fps") opts.fps = Number(value);
    if (arg === "--probe-every") opts.probeEvery = Number(value);
    if (arg === "--limit-frames") opts.limitFrames = Number(value);
    if (arg === "--segment") opts.segment = value;
    if (arg === "--hook") opts.hook = value;
    if (arg === "--chrome") opts.chrome = value;
    if (arg === "--timeout") opts.timeout = Number(value);
  }
  if (!opts.chrome) fail("Kein Chrome/Chromium gefunden. Setze CHROME_PATH oder --chrome.");
  if (!Number.isInteger(opts.index) || opts.index < 0) fail("Aufgabenindex muss eine ganze Zahl ab 0 sein.");
  if (!Number.isInteger(opts.timeout) || opts.timeout < 1000) fail("Timeout muss mindestens 1000 ms betragen.");
  if (!Number.isInteger(opts.probeEvery) || opts.probeEvery < 1) {
    fail("Stichprobenabstand muss mindestens 1 sein.");
  }
  if (!Number.isInteger(opts.limitFrames) || opts.limitFrames < 0) {
    fail("Frame-Limit muss eine ganze Zahl ab 0 sein (0 = vollständig).");
  }
  /* Erlaubt sind genau die Segmente der Zeitachse — nichts anderes. */
  if (opts.segment && !timeline.SEGMENTS.some(function (entry) {
    return entry.id === opts.segment;
  })) {
    fail("Unbekanntes Segment \"" + opts.segment +
      "\". Erlaubt sind: " + timeline.SEGMENTS.map(function (entry) { return entry.id; }).join(", ") + ".");
  }
  /* P7.4.1 — Hook-Vorlage. Unbekannt ist ein Fehler, kein stiller Fallback. */
  if (opts.hook !== undefined) timeline.hookById(opts.hook);
  if (opts.segment && opts.limitFrames > 0) {
    fail("--segment und --limit-frames schliessen sich gegenseitig aus.");
  }
  if (!opts.episode.trim() || !opts.out.trim()) fail("Episode und Ausgabepfad dürfen nicht leer sein.");
  return opts;
}

function frameName(frame) {
  return "frame-" + String(frame).padStart(4, "0") + ".png";
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/* Geometrie- und Inhaltsprüfung der gerenderten Bühne. */
function assertStage(stage) {
  if (!stage) fail("Bühne hat keinen messbaren Zustand.");
  if (stage.stage.width !== STAGE_WIDTH || stage.stage.height !== STAGE_HEIGHT) {
    fail("Bühne misst " + stage.stage.width + "x" + stage.stage.height +
      " statt " + STAGE_WIDTH + "x" + STAGE_HEIGHT + ".");
  }
  if (stage.docScroll.width > STAGE_WIDTH || stage.docScroll.height > STAGE_HEIGHT) {
    fail("Seite scrollt (" + stage.docScroll.width + "x" + stage.docScroll.height +
      "): die Bühne darf nicht über den Rahmen hinauslaufen.");
  }
  if (stage.offenders.length) {
    fail("Bühnenbereich ragt heraus: " + stage.offenders.map(function (entry) {
      return entry.name + " (" + entry.reason + ")";
    }).join(", "));
  }
  if (stage.clipped.length) {
    fail("Text ist abgeschnitten: " + stage.clipped.map(function (entry) {
      return entry.id + " " + entry.scrollHeight + ">" + entry.clientHeight;
    }).join(", "));
  }
  if (stage.scripts.length || stage.resources.length) {
    fail("Bühne hat externe Ressourcen geladen.");
  }
  if (stage.storage.accessible && (stage.storage.local !== 0 || stage.storage.session !== 0)) {
    fail("Bühne hat Daten im Browserstorage abgelegt.");
  }
}

function assertMatchesExercise(stage, exercise) {
  if (stage.promptText !== exercise.prompt) fail("Gerenderte Frage weicht vom Aufgaben-JSON ab.");
  if (stage.badgeText !== exercise.badge) fail("Gerenderter Badge weicht vom Aufgaben-JSON ab.");
  if (!stage.svgRect || stage.svgRect.width <= 0 || stage.svgRect.height <= 0) {
    fail("Blueprint-SVG ist auf der Bühne nicht sichtbar.");
  }
  if (stage.outlineCount === 0) fail("Blueprint-SVG enthält keine Reveal-Pfade.");
  if (stage.drawableCount === 0) fail("Blueprint-SVG hat keine sichtbare Kontur zum Aufzeichnen.");
  /*
   * Die Bühne folgt der App-Markierung, wenn es eine gibt. Sonst arbeitet sie
   * mit den sichtbaren Konturen der obersten SVG-Ebene.
   */
  const marked = (exercise.svg.match(/class\s*=\s*["'][^"']*\bshape-outline\b[^"']*["']/gi) || []).length;
  if (marked > 0) {
    if (stage.revealMode !== "marked" || stage.outlineCount !== marked) {
      fail("Reveal-Pfade weichen vom Aufgaben-JSON ab (" + stage.outlineCount + " statt " + marked + ").");
    }
  } else if (stage.revealMode !== "generic") {
    fail("Reveal-Pfade wurden nicht erkannt, obwohl das SVG sie markiert.");
  }
  if (stage.solutionOpacity !== "0") fail("Auflösung ist vor der Auflösungsphase sichtbar.");
}

/*
 * P7.3.5 — Der Clip muss Hook, Auflösung und Endcard real zeigen.
 * Geprüft wird am jeweils letzten Frame des Segments, was tatsächlich
 * im Bild steht — nicht nur, was die Zeitachse behauptet.
 */
function assertSegmentStage(stage, segment) {
  if (segment.id === "solution") {
    if (!stage.solutionVisible || Number(stage.solutionOpacity) < 0.99) {
      fail("Auflösung ist am Ende ihres Segments nicht voll sichtbar (Deckkraft " +
        stage.solutionOpacity + ").");
    }
  }
  if (segment.id === "endcard") {
    if (!stage.endcardVisible || Number(stage.endcardOpacity) < 0.99) {
      fail("Endcard ist am Ende ihres Segments nicht voll sichtbar (Deckkraft " +
        stage.endcardOpacity + ").");
    }
    if (stage.endcardName !== timeline.BRAND_NAME) {
      fail("Endcard nennt \"" + stage.endcardName + "\" statt \"" + timeline.BRAND_NAME + "\".");
    }
    if (stage.endcardUrl !== timeline.BRAND_URL) {
      fail("Endcard zeigt \"" + stage.endcardUrl + "\" statt \"" + timeline.BRAND_URL + "\".");
    }
    /*
     * Das Eulenzeichen soll so gross wie moeglich sein. Geprueft wird die
     * tatsaechlich gerenderte Box: sie muss randlos die volle Buehnenbreite
     * fuellen und darf weder ueber den Rand stehen noch unter die Karte schrumpfen.
     */
    if (!stage.endcardLogo || !stage.endcardLogo.width || !stage.endcardLogo.height) {
      fail("Eulenzeichen ist auf der Endcard nicht messbar.");
    }
    if (stage.endcardLogoFill < MIN_LOGO_FILL) {
      fail("Eulenzeichen fuellt nur " + Math.round(stage.endcardLogoFill * 100) +
        "% der Buehnenbreite, gefordert sind mindestens " + Math.round(MIN_LOGO_FILL * 100) + "%.");
    }
    if (stage.endcardLogoFill > 1.001) {
      fail("Eulenzeichen ragt mit " + stage.endcardLogo.width + "px ueber die Buehnenbreite hinaus.");
    }
    if (stage.endcardLogo.left > 0 || stage.endcardLogo.right < STAGE_WIDTH) {
      fail("Eulenzeichen ist nicht randlos (links " + stage.endcardLogo.left +
        "px, rechts " + stage.endcardLogo.right + "px statt 0/" + STAGE_WIDTH + ").");
    }
    /* Der Textblock darunter muss vollstaendig unter dem Logo Platz finden. */
    if (stage.endcardLogo.bottom >= STAGE_HEIGHT) {
      fail("Eulenzeichen endet bei " + stage.endcardLogo.bottom +
        "px und laesst keinen Platz fuer Name, URL und Claim.");
    }
  }
}

/* 7.3.5 — Die Endcard muss den Abschluss bilden, nicht schon den Hook. */
function assertEndcardTimeline(plan) {
  const endcard = plan.segments.find(function (segment) { return segment.id === ENDCARD_SEGMENT; });
  const solution = plan.segments.find(function (segment) { return segment.id === SOLUTION_SEGMENT; });
  if (!endcard) fail("Zeitachse enthält keine Endcard.");
  const seconds = (endcard.toTimeMs - endcard.fromTimeMs) / 1000;
  if (seconds < MIN_ENDCARD_SECONDS || seconds > MAX_ENDCARD_SECONDS) {
    fail("Endcard dauert " + seconds + " s und liegt damit außerhalb der " +
      MIN_ENDCARD_SECONDS + "–" + MAX_ENDCARD_SECONDS + " s.");
  }
  if (solution && endcard.fromFrame <= solution.toFrame) {
    fail("Endcard muss nach der Auflösung beginnen.");
  }
}

async function render(opts) {
  const episodePath = resolvePipelinePath(opts.episode);
  const framesDir = resolvePipelinePath(opts.out);
  const selected = readEpisode(episodePath, opts.index);
  const plan = buildTimeline(opts.fps, opts.hook);

  const pause = plan.segments.find(function (segment) { return segment.id === PAUSE_SEGMENT; });
  if (!pause) fail("Zeitachse enthält keine Denkpause.");
  if (pause.toTimeMs - pause.fromTimeMs < MIN_PAUSE_MS) {
    fail("Denkpause vor der Auflösung muss mindestens " + MIN_PAUSE_MS + " ms dauern.");
  }
  if (plan.totalSeconds < 15 || plan.totalSeconds > 25) {
    fail("Bühnenlänge " + plan.totalSeconds + " s liegt außerhalb der 15–25 s.");
  }
  assertEndcardTimeline(plan);

  const template = fs.readFileSync(path.join(__dirname, STAGE_TEMPLATE), "utf8");
  const cssBase = fs.readFileSync(path.join(REPO_ROOT, "style-base.css"), "utf8");
  const cssActive = fs.readFileSync(path.join(REPO_ROOT, "style-active.css"), "utf8");
  const appBase = fs.readFileSync(path.join(REPO_ROOT, "app-base.js"), "utf8");
  const html = buildDocument(template, cssBase, cssActive, appBase, selected.episode, opts.index, plan);

  fs.mkdirSync(framesDir, { recursive: true });
  const frames = [];
  const checks = {
    overflowCount: 0,
    clippedTextCount: 0,
    blackProbedFrames: 0,
    blackFrameCount: 0,
    probeStep: 8
  };

  let activeScene = null;
  try {
    activeScene = await startIsolatedScene(opts, html, { width: STAGE_WIDTH, height: STAGE_HEIGHT });
    const page = activeScene.page;
    await page.waitForFunction(function () {
      return document.documentElement.dataset.contentPipelineStageReady === "true";
    }, { timeout: opts.timeout });
    await sleep(600);

    const applyFrame = function (state) {
      return page.evaluate(function (next) {
        window.__STAGE__.apply(next);
        return new Promise(function (resolve) {
          window.requestAnimationFrame(function () { window.requestAnimationFrame(resolve); });
        });
      }, state);
    };
    const measureStage = function (state) {
      return page.evaluate(function (next) { return window.__STAGE__.measure(next); }, state);
    };

    const first = frameState(plan, 0);
    await applyFrame(first);
    const stage = await measureStage(first);
    assertStage(stage);
    assertMatchesExercise(stage, selected.exercise);

    /*
     * 7.3.5 — Am letzten Frame jedes Segments messen, was wirklich im Bild steht.
     * Geprüft werden nur Segmente, die im (eventuell verkürzten) Lauf ganz
     * gerendert wurden, sonst wäre ein --limit-Frames- oder --segment-Lauf
     * grundlos defekt. --segment legt den Bereich fest: die Frame-Nummern
     * bleiben global, damit ein Segment-Lauf eindeutig in der Zeitachse
     * verortet ist.
     */
    const measuredSegments = {};
    let endcardProof = null;
    const firstFrame = opts.segment ? segmentById(plan, opts.segment).fromFrame : 0;
    const lastFrame = opts.segment
      ? segmentById(plan, opts.segment).toFrame
      : Math.min(plan.totalFrames, (opts.limitFrames > 0 ? opts.limitFrames : plan.totalFrames)) - 1;
    const renderCount = lastFrame - firstFrame + 1;
    for (let frame = firstFrame; frame <= lastFrame; frame += 1) {
      const state = frameState(plan, frame);
      await applyFrame(state);
      const buffer = await page.screenshot({ type: "png", fullPage: false, captureBeyondViewport: false });
      const name = frameName(frame);
      writeAtomic(path.join(framesDir, name), buffer);

      if (frame > 0 && frame === segmentAt(plan, frame).toFrame) {
        const measured = await measureStage(state);
        assertStage(measured);
        assertSegmentStage(measured, segmentAt(plan, frame));
        measuredSegments[state.segment] = true;
        /* Messwerte der Endcard ins Manifest: der Nachweis steckt in der Zahl. */
        if (state.segment === ENDCARD_SEGMENT) {
          endcardProof = {
            frame: frame,
            opacity: measured.endcardOpacity,
            logoBox: measured.endcardLogo,
            logoFillRatio: measured.endcardLogoFill,
            name: measured.endcardName,
            url: measured.endcardUrl
          };
        }
      }

      const isProbe = frame % opts.probeEvery === 0 || frame === plan.totalFrames - 1;
      if (isProbe) {
        const probe = png.probeFrame(buffer, { step: checks.probeStep });
        if (probe.width !== STAGE_WIDTH || probe.height !== STAGE_HEIGHT) {
          fail("Frame " + frame + " misst " + probe.width + "x" + probe.height + ".");
        }
        if (probe.blackCorners || probe.blackEdges.length) {
          fail("Frame " + frame + " hat schwarze Randbereiche (Ecken: " + probe.blackCorners +
            ", Ränder: " + probe.blackEdges.join(",") + ").");
        }
        if (probe.blackRatio > MAX_BLACK_RATIO) {
          fail("Frame " + frame + " ist zu " + Math.round(probe.blackRatio * 100) + " % schwarz.");
        }
        checks.blackProbedFrames += 1;
      }

      frames.push({
        frame: frame,
        timeMs: state.timeMs,
        segment: state.segment,
        /* Zustand im Bild, damit Folgeschritte den Reveal nicht neu berechnen müssen. */
        revealProgress: state.revealProgress,
        solutionVisible: state.solutionVisible,
        pauseActive: state.pauseActive,
        /* P7.4.2 — Countdown wird mitgeschrieben, damit die Gegenprobe am
           Bild den Timer bestaetigen kann, statt nur die Zeitachse zu fragen. */
        countdownVisible: state.countdownVisible,
        countdownValue: state.countdownValue,
        countdownProgress: state.countdownProgress,
        endcardVisible: state.endcardVisible,
        endcardProgress: state.endcardProgress,
        file: name,
        bytes: buffer.length,
        sha256: sha256(buffer)
      });

      if ((frame - firstFrame + 1) % 60 === 0 || frame === lastFrame) {
        process.stderr.write("Frames " + (frame - firstFrame + 1) + "/" + renderCount + "\n");
      }
    }

    assertNoSceneErrors(activeScene.collectors);
    /*
     * 7.3.5 — Ein als vollständig geltender Lauf muss Hook, Auflösung und
     * Endcard auch wirklich am Bild geprüft haben.
     */
    if (firstFrame === 0 && frames.length === plan.totalFrames) {
      const required = [PAUSE_SEGMENT, SOLUTION_SEGMENT, ENDCARD_SEGMENT];
      const missing = required.filter(function (id) { return !measuredSegments[id]; });
      if (missing.length) {
        fail("Vollständiger Lauf hat die Segmente nicht geprüft: " + missing.join(", "));
      }
    }

    const manifest = {
      schemaVersion: 1,
      stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      fps: plan.fps,
      totalFrames: plan.totalFrames,
      totalSeconds: plan.totalSeconds,
      totalMs: plan.totalMs,
      renderedFrames: frames.length,
      /* Nur ein vollständiger Lauf ist als Clip-Quelle freigabefähig. */
      complete: firstFrame === 0 && frames.length === plan.totalFrames,
      /* Welchen Bereich der Zeitachse dieser Lauf abgedeckt hat. */
      renderedRange: { fromFrame: firstFrame, toFrame: lastFrame },
      requestedSegment: opts.segment || null,
      /* P7.4.1 — welche Hook-Vorlage diesen Lauf erzeugt hat. */
      hook: plan.hook,
      hookLabel: plan.hookLabel,
      pauseMode: plan.pauseMode,
      countdownSeconds: plan.countdownSeconds,
      pauseMs: pause.toTimeMs - pause.fromTimeMs,
      endcardMs: plan.segments.find(function (segment) { return segment.id === ENDCARD_SEGMENT; })
        .toTimeMs - plan.segments.find(function (segment) { return segment.id === ENDCARD_SEGMENT; }).fromTimeMs,
      /* Welche Segmente am Bild geprüft wurden — Pflicht für einen kompletten Lauf. */
      measuredSegments: Object.keys(measuredSegments).sort(),
      endcardProof: endcardProof,
      segments: plan.segments,
      episodePath: episodePath,
      exerciseIndex: opts.index,
      generator: selected.exercise.generator,
      seed: selected.episode.seed,
      framesDir: framesDir,
      frames: frames,
      checks: checks,
      blockedRequestCount: activeScene.collectors.blockedRequests.length,
      storageItemCount: stage.storage.accessible ? stage.storage.local + stage.storage.session : 0,
      frameSetSha256: sha256(Buffer.from(frames.map(function (entry) { return entry.sha256; }).join("\n"), "utf8"))
    };
    const manifestPath = path.join(framesDir, MANIFEST_NAME);
    writeAtomic(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    return manifest;
  } finally {
    await closeIsolatedScene(activeScene);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const manifest = await render(opts);
  process.stdout.write(JSON.stringify({
    framesDir: manifest.framesDir,
    frameCount: manifest.frames.length,
    complete: manifest.complete,
    frameSetSha256: manifest.frameSetSha256,
    fps: manifest.fps,
    totalSeconds: manifest.totalSeconds,
    pauseMs: manifest.pauseMs,
    stage: manifest.stage
  }, null, 2) + "\n");
}

if (require.main === module) {
  main().catch(function (error) {
    process.stderr.write("FEHLER: " + (error && error.message ? error.message : String(error)) + "\n");
    process.exit(1);
  });
}

module.exports = { parseArgs: parseArgs, frameName: frameName, sha256: sha256, render: render };
