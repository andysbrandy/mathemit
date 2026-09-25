#!/usr/bin/env node
"use strict";

/*
 * P7.3.2 — Isolate Browser-Vorschau für ausgewählte Aufgaben.
 * Nur Inline-CSS, app-base.js und JSON: kein Backend, Storage oder Netzwerk.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
];
const DEFAULT_EPISODE = "work/episode.json";
const DEFAULT_SCREENSHOT = "work/previews/exercise.png";
const DEFAULT_TIMEOUT_MS = 15000;
const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 900;
const PREVIEW_ORIGIN = "https://content-pipeline.invalid/";
const REPO_ROOT = path.resolve(__dirname, "..");

function fail(message) {
  const error = new Error(message);
  error.code = "P7_PREVIEW";
  throw error;
}

function usage() {
  return [
    "Verwendung: node content-pipeline/render-preview.js [Optionen]",
    "",
    "  --episode <datei.json>  Aufgaben-Episode (Standard: " + DEFAULT_EPISODE + ")",
    "  --index <0|1|2|3|4>    Aufgabe aus der Episode (Standard: 0)",
    "  --out <datei.png>      Screenshot-Ausgabe",
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
    chrome: findChrome(),
    timeout: DEFAULT_TIMEOUT_MS
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (!["--episode", "--index", "--out", "--chrome", "--timeout"].includes(arg)) {
      fail("Unbekannte Option: " + arg + "\n\n" + usage());
    }
    if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
    const value = argv[++i];
    if (arg === "--episode") opts.episode = value;
    if (arg === "--index") opts.index = Number(value);
    if (arg === "--out") opts.out = value;
    if (arg === "--chrome") opts.chrome = value;
    if (arg === "--timeout") opts.timeout = Number(value);
  }
  if (!opts.chrome) fail("Kein Chrome/Chromium gefunden. Setze CHROME_PATH oder --chrome.");
  if (!Number.isInteger(opts.index) || opts.index < 0) fail("Aufgabenindex muss eine ganze Zahl ab 0 sein.");
  if (!Number.isInteger(opts.timeout) || opts.timeout < 1000) fail("Timeout muss mindestens 1000 ms betragen.");
  if (!opts.episode.trim() || !opts.out.trim()) fail("Episode und Ausgabepfad dürfen nicht leer sein.");
  return opts;
}

function findChrome() {
  return CHROME_PATHS.find(function (candidate) {
    return candidate && fs.existsSync(candidate);
  }) || null;
}

function resolvePipelinePath(value) {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(__dirname, value);
}

function isChoiceExercise(exercise) {
  return exercise.inputType === "choice" || exercise.inputType === "mc";
}

function readEpisode(episodePath, index) {
  let episode;
  try {
    episode = JSON.parse(fs.readFileSync(episodePath, "utf8"));
  } catch (error) {
    fail("Episode kann nicht gelesen werden: " + error.message);
  }
  if (!episode || episode.schemaVersion !== 1 || !Array.isArray(episode.exercises)) {
    fail("Episode hat kein unterstütztes Format (schemaVersion 1 + exercises).");
  }
  if (index >= episode.exercises.length) {
    fail("Aufgabenindex " + index + " liegt außerhalb der Episode (" + episode.exercises.length + ").");
  }
  const exercise = episode.exercises[index];
  ["generator", "prompt", "svg", "badge", "badgeColor", "inputType", "answer", "explanation"].forEach(function (field) {
    if (exercise[field] === undefined || exercise[field] === null || exercise[field] === "") {
      fail("Gewählte Aufgabe hat kein Pflichtfeld: " + field);
    }
  });
  if (exercise.inputType !== "number" && !isChoiceExercise(exercise)) {
    fail("Gewählte Aufgabe hat einen unbekannten Input-Typ: " + exercise.inputType);
  }
  if (isChoiceExercise(exercise) && (!Array.isArray(exercise.choices) || exercise.choices.length < 2)) {
    fail("Gewählte Auswahlaufgabe hat keine gültigen Antwortmöglichkeiten.");
  }
  if (!/<svg[\s>]/i.test(exercise.svg) || !/<\/svg>/i.test(exercise.svg)) {
    fail("Gewählte Aufgabe enthält kein vollständiges SVG.");
  }
  return { episode: episode, exercise: exercise };
}

function buildDocument(template, cssBase, cssActive, appBase, episode, index) {
  const payload = JSON.stringify(Object.assign({}, episode, { previewIndex: index }));
  const marker = '<script id="episode-data" type="application/json">{}</script>';
  if (!template.includes(marker)) fail("Preview-Template enthält keinen episode-data-Platzhalter.");
  if (!template.includes("<!-- APP_STYLES -->") || !template.includes("<!-- APP_SCRIPT -->")) {
    fail("Preview-Template enthält nicht alle Inline-Platzhalter.");
  }

  let html = template
    .replace(marker, '<script id="episode-data" type="application/json">' +
      payload.replace(/&/g, "\\u0026").replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
        .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") + "</script>")
    .replace("<!-- APP_STYLES -->", "<style>\n" + cssBase + "\n" + cssActive + "\n</style>")
    .replace("<!-- APP_SCRIPT -->", "<script>\n" + appBase + "\n</script>");

  if (/<script[^>]+src=|<link[^>]+(?:href|src)=(?!\s*["']data:)[^>]+>|<img[^>]+src=/i.test(html)) {
    fail("Preview enthält nach der Inline-Erzeugung noch externe Ressourcen.");
  }
  /*
   * Kommentare werden vor der Prüfung entfernt: app-base.js darf die
   * aktive App in einem Kommentar erwähnen, führt sie aber nicht aus.
   */
  const executableAppBase = appBase
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  if (/app-active\.js|backend\/|localStorage|sessionStorage|indexedDB|sendBeacon|XMLHttpRequest|WebSocket/i.test(executableAppBase)) {
    fail("app-base.js enthält unerlaubte App-, Backend- oder Storage-Logik.");
  }
  return html;
}

function normaliseSvg(svg) {
  return svg
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/\s+style="[^"]*"/g, "")
    /* Chrome serialisiert leere SVG-Elemente als <rect></rect>. */
    .replace(/<(rect|circle|ellipse|line|path|polygon|polyline|stop|use)\b([^>]*)\/\>/gi, "<$1$2></$1>")
    .replace(/<(rect|circle|ellipse|line|path|polygon|polyline|stop|use)\b([^>]*)><\/\1>/gi, "<$1$2></$1>")
    .trim();
}

function writeAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = filePath + ".tmp-" + process.pid;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, filePath);
}

async function render(opts) {
  const episodePath = resolvePipelinePath(opts.episode);
  const outputPath = resolvePipelinePath(opts.out);
  const selected = readEpisode(episodePath, opts.index);
  const template = fs.readFileSync(path.join(__dirname, "preview", "exercise-preview.html"), "utf8");
  const cssBase = fs.readFileSync(path.join(REPO_ROOT, "style-base.css"), "utf8");
  const cssActive = fs.readFileSync(path.join(REPO_ROOT, "style-active.css"), "utf8");
  const appBase = fs.readFileSync(path.join(REPO_ROOT, "app-base.js"), "utf8");
  const html = buildDocument(template, cssBase, cssActive, appBase, selected.episode, opts.index);

  let browser = null;
  let userDataDir = null;
  const blockedRequests = [];
  const pageErrors = [];
  const consoleErrors = [];
  try {
      userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p7-browser-"));
      browser = await puppeteer.launch({
        executablePath: opts.chrome,
        headless: true,
        userDataDir: userDataDir,
        args: [
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--mute-audio"
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, deviceScaleFactor: 1 });
    page.setDefaultTimeout(opts.timeout);
    page.setDefaultNavigationTimeout(opts.timeout);
    await page.setRequestInterception(true);
    page.on("request", function (request) {
      const url = request.url();
      if (url === PREVIEW_ORIGIN) {
        request.respond({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: html
        });
        return;
      }
      if (url === "about:blank" || url.startsWith("data:")) {
        request.continue();
        return;
      }
      blockedRequests.push(url);
      request.abort("blockedbyclient");
    });
    page.on("pageerror", function (error) { pageErrors.push(error.message); });
    page.on("console", function (message) {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(PREVIEW_ORIGIN, { waitUntil: "domcontentloaded", timeout: opts.timeout });
    await page.waitForFunction(function () {
      return document.documentElement.dataset.contentPipelineReady === "true";
    }, { timeout: opts.timeout });
    await new Promise(function (resolve) { setTimeout(resolve, 1100); });

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

    if (blockedRequests.length) fail("Browser hat externe Ressourcen angefordert: " + blockedRequests.join(", "));
    if (pageErrors.length || consoleErrors.length) {
      fail("Browserfehler: " + pageErrors.concat(consoleErrors).join(" | "));
    }
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
      blockedRequestCount: blockedRequests.length,
      storageItemCount: result.storage.accessible ? result.storage.local + result.storage.session : 0,
      storageAccessible: result.storage.accessible
    };
  } finally {
    if (browser) await browser.close();
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
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


