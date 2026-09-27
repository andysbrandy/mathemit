#!/usr/bin/env node
"use strict";

/*
 * P7.3.2 — Isolate Browser-Vorschau für ausgewählte Aufgaben.
 * Nur Inline-CSS, app-base.js und JSON: kein Backend, Storage oder Netzwerk.
 */

const fs = require("node:fs");
const path = require("node:path");
const scene = require("./lib/isolated-scene");

const DEFAULT_EPISODE = "content-pipeline/work/episode.json";
const DEFAULT_SCREENSHOT = "content-pipeline/work/previews/exercise.png";
const DEFAULT_TIMEOUT_MS = 15000;
const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 900;
/* P7.4.1 — die Vorschau teilt sich die Hook-Vorlagen mit dem Renderer. */
const timeline = require("./lib/timeline");
const REPO_ROOT = scene.REPO_ROOT;
const fail = scene.fail;
const findChrome = scene.findChrome;
const resolvePipelinePath = scene.resolvePipelinePath;
const isChoiceExercise = scene.isChoiceExercise;
const readEpisode = scene.readEpisode;
const buildDocument = scene.buildDocument;
const writeAtomic = scene.writeAtomic;
const sleep = scene.sleep;
const startIsolatedScene = scene.startIsolatedScene;
const closeIsolatedScene = scene.closeIsolatedScene;
const assertNoSceneErrors = scene.assertNoSceneErrors;

function usage() {
  return [
    "Verwendung: node content-pipeline/render-preview.js [Optionen]",
    "",
    "  --episode <datei.json>  Aufgaben-Episode (Standard: " + DEFAULT_EPISODE + ")",
    "  --index <0|1|2|3|4>    Aufgabe aus der Episode (Standard: 0)",
    "  --out <datei.png>      Screenshot-Ausgabe",
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
    out: DEFAULT_SCREENSHOT,
    hook: timeline.DEFAULT_HOOK,
    chrome: findChrome(),
    timeout: DEFAULT_TIMEOUT_MS
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (!["--episode", "--index", "--out", "--hook", "--chrome", "--timeout"].includes(arg)) {
      fail("Unbekannte Option: " + arg + "\n\n" + usage());
    }
    if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
    const value = argv[++i];
    if (arg === "--episode") opts.episode = value;
    if (arg === "--index") opts.index = Number(value);
    if (arg === "--out") opts.out = value;
    if (arg === "--hook") opts.hook = value;
    if (arg === "--chrome") opts.chrome = value;
    if (arg === "--timeout") opts.timeout = Number(value);
  }
  if (!opts.chrome) fail("Kein Chrome/Chromium gefunden. Setze CHROME_PATH oder --chrome.");
  if (!Number.isInteger(opts.index) || opts.index < 0) fail("Aufgabenindex muss eine ganze Zahl ab 0 sein.");
  if (!Number.isInteger(opts.timeout) || opts.timeout < 1000) fail("Timeout muss mindestens 1000 ms betragen.");
  if (!opts.episode.trim() || !opts.out.trim()) fail("Episode und Ausgabepfad dürfen nicht leer sein.");
  /* Unbekannte Vorlage ist ein Fehler, kein stiller Rückfall auf "frage". */
  timeline.hookById(opts.hook);
  return opts;
}


async function render(opts) {
  const episodePath = resolvePipelinePath(opts.episode);
  const outputPath = resolvePipelinePath(opts.out);
  const selected = readEpisode(episodePath, opts.index);
  const template = fs.readFileSync(path.join(__dirname, "preview", "exercise-preview.html"), "utf8");
  const cssBase = fs.readFileSync(path.join(REPO_ROOT, "style-base.css"), "utf8");
  const cssActive = fs.readFileSync(path.join(REPO_ROOT, "style-active.css"), "utf8");
  const appBase = fs.readFileSync(path.join(REPO_ROOT, "app-base.js"), "utf8");
  const html = buildDocument(template, cssBase, cssActive, appBase, selected.episode, opts.index,
    timeline.buildTimeline(timeline.DEFAULT_FPS, opts.hook));

  let activeScene = null;
  let page = null;
  let collectors = null;
  try {
    activeScene = await startIsolatedScene(opts, html, { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT });
    page = activeScene.page;
    collectors = activeScene.collectors;
    await page.waitForFunction(function () {
      return document.documentElement.dataset.contentPipelineReady === "true";
    }, { timeout: opts.timeout });
    await sleep(1100);

    const result = await page.evaluate(function () {
      const svg = document.querySelector("#figureHost svg");
      const badge = document.getElementById("topicBadge");
      const prompt = document.getElementById("previewPrompt");
      const answer = document.getElementById("previewAnswer");
      const exercise = JSON.parse(document.documentElement.dataset.contentPipelineExercise || "{}");
      const expectedBadge = document.createElement("span");
      expectedBadge.style.background = exercise.badgeColor;
      document.body.appendChild(expectedBadge);
      function visible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }
      const storage = { local: null, session: null, accessible: false, error: null };
      try {
        storage.local = window.localStorage.length;
        storage.session = window.sessionStorage.length;
        storage.accessible = true;
      } catch (error) {
        storage.error = error.name + ": " + error.message;
      }
      let cookies = null;
      try {
        cookies = document.cookie;
      } catch (error) {
        cookies = error.name + ": " + error.message;
      }
      const sourceTemplate = document.createElement("template");
      sourceTemplate.innerHTML = exercise.svg || "";
      const sourceSvg = sourceTemplate.content.querySelector("svg");
      function removeRevealStyles(root) {
        if (!root) return;
        Array.prototype.forEach.call(root.querySelectorAll(".shape-outline"), function (path) {
          path.removeAttribute("style");
        });
      }
      function canonicalNode(node) {
        if (!node) return null;
        if (node.nodeType === Node.TEXT_NODE) return { type: "text", value: node.nodeValue || "" };
        if (node.nodeType !== Node.ELEMENT_NODE) return { type: "other", name: node.nodeName };
        const attributes = Array.prototype.map.call(node.attributes, function (attribute) {
          if (node.classList.contains("shape-outline") && attribute.name === "style") return null;
          return [attribute.name, attribute.value];
        }).filter(Boolean).sort(function (left, right) {
          return left[0].localeCompare(right[0]);
        });
        return {
          type: "element",
          name: node.localName,
          attributes: attributes,
          children: Array.prototype.map.call(node.childNodes, canonicalNode)
        };
      }
      removeRevealStyles(sourceSvg);
      removeRevealStyles(svg);
      const canonicalSourceSvg = canonicalNode(sourceSvg);
      const canonicalRenderedSvg = canonicalNode(svg);
      const expectedBadgeColor = getComputedStyle(expectedBadge).backgroundColor;
      expectedBadge.remove();
      return {
        prompt: prompt ? prompt.textContent : null,
        promptVisible: visible(prompt),
        badge: badge ? badge.textContent : null,
        badgeColor: badge ? getComputedStyle(badge).backgroundColor : null,
        expectedBadgeColor: expectedBadgeColor,
        badgeVisible: visible(badge),
        svg: svg ? svg.outerHTML : null,
        sourceSvg: JSON.stringify(canonicalSourceSvg),
        renderedSvg: JSON.stringify(canonicalRenderedSvg),
        svgMatchesSource: JSON.stringify(canonicalSourceSvg) === JSON.stringify(canonicalRenderedSvg),
        svgVisible: visible(svg),
        outlineCount: document.querySelectorAll("#figureHost .shape-outline").length,
        answer: answer.textContent,
        answerVisible: visible(answer),
        choices: JSON.parse(document.documentElement.dataset.contentPipelineChoices || "[]"),
        choiceCount: document.querySelectorAll("#previewAnswer li").length,
        storage: storage,
        cookies: cookies,
        activeScriptSources: Array.prototype.map.call(document.scripts, function (script) { return script.src; }).filter(Boolean),
        resources: performance.getEntriesByType("resource").map(function (entry) { return entry.name; })
      };
    });

    assertNoSceneErrors(collectors);
    if (!result.promptVisible || !result.badgeVisible || !result.svgVisible || !result.answerVisible) {
      fail("Mindestens ein Bestandteil der Vorschau ist nicht sichtbar.");
    }
    if (result.prompt !== selected.exercise.prompt) fail("Gerenderte Frage weicht vom Aufgaben-JSON ab.");
    if (result.badge !== selected.exercise.badge) fail("Gerenderter Badge weicht vom Aufgaben-JSON ab.");
    if (result.badgeColor !== result.expectedBadgeColor) fail("Gerenderte Badge-Farbe weicht vom Aufgaben-JSON ab.");
    const sourceOutlineCount = (selected.exercise.svg.match(/class\s*=\s*["'][^"']*\bshape-outline\b[^"']*["']/gi) || []).length;
    if (!result.svgMatchesSource) {
      const sourceSvg = result.sourceSvg || "";
      const renderedSvg = result.renderedSvg || "";
      const mismatchAt = Array.from({ length: Math.max(sourceSvg.length, renderedSvg.length) }, function (_, index) {
        return sourceSvg[index] === renderedSvg[index] ? null : index;
      }).filter(function (index) { return index !== null; }).slice(0, 12);
      const context = mismatchAt.map(function (index) {
        return "@" + index + " Quelle=" + JSON.stringify(sourceSvg.slice(Math.max(0, index - 20), index + 30)) +
          " DOM=" + JSON.stringify(renderedSvg.slice(Math.max(0, index - 20), index + 30));
      }).join(" | ");
      fail("Gerendertes Blueprint-SVG weicht semantisch vom Aufgaben-JSON ab" + (context ? ": " + context : "."));
    }
    if (result.outlineCount !== sourceOutlineCount) {
      fail("Anzahl der Blueprint-Reveal-Pfade weicht vom Aufgaben-JSON ab.");
    }
    if (result.storage.accessible && (result.storage.local !== 0 || result.storage.session !== 0)) {
      fail("Preview hat Daten im Browserstorage abgelegt.");
    }
    if (result.cookies !== "") {
      fail("Preview hat Cookies abgelegt oder konnte den Cookie-Zustand nicht prüfen.");
    }
    if (result.activeScriptSources.length || result.resources.length) {
      fail("Preview hat externe Ressourcen geladen.");
    }
    if (isChoiceExercise(selected.exercise)) {
      if (result.choiceCount !== selected.exercise.choices.length || JSON.stringify(result.choices) !== JSON.stringify(selected.exercise.choices)) {
        fail("Nicht alle Antwortmöglichkeiten wurden sichtbar gerendert.");
      }
    } else if (result.answer.trim() !== String(selected.exercise.answer) + (selected.exercise.unit || "")) {
      fail("Gerenderte Antwort weicht vom Aufgaben-JSON ab.");
    }

    const buffer = await page.screenshot({ type: "png", fullPage: false, captureBeyondViewport: false });
    writeAtomic(outputPath, buffer);

    return {
      exerciseIndex: opts.index,
      generator: selected.exercise.generator,
      episodePath: episodePath,
      screenshotPath: outputPath,
      screenshotBytes: buffer.length,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      blockedRequestCount: collectors.blockedRequests.length,
      storageItemCount: result.storage.accessible ? result.storage.local + result.storage.session : 0,
      storageAccessible: result.storage.accessible
    };
  } finally {
    await closeIsolatedScene(activeScene);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = await render(opts);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (require.main === module) {
  main().catch(function (error) {
    process.stderr.write("FEHLER: " + (error.message || error) + "\n");
    process.exit(1);
  });
}


