#!/usr/bin/env node
"use strict";

/*
 * P7.3.2/P7.3.3 — Gemeinsamer, isolierter Browser-Aufbau der Content-Pipeline.
 * Dieselbe Szene für Vorschau (9:16-Standbild) und Frames der Video-Bühne:
 * nur Inline-CSS, app-base.js und JSON — kein Backend, kein Storage, kein Netz.
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
const SCENE_ORIGIN = "https://content-pipeline.invalid/";
const PIPELINE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(PIPELINE_ROOT, "..");
const LAUNCH_ARGS = [
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-sync",
  "--disable-gpu",
  "--disable-lcd-text",
  "--force-color-profile=srgb",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--metrics-recording-only",
  "--mute-audio",
  "--font-render-hinting=none"
];

function fail(message) {
  const error = new Error(message);
  error.code = "P7_SCENE";
  throw error;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function findChrome() {
  return CHROME_PATHS.find(function (candidate) {
    return candidate && fs.existsSync(candidate);
  }) || null;
}

/*
 * Relative Pfade loesen immer gegen die Repo-Wurzel auf, unabhaengig vom
 * Startordner. Das ist die seit P7.3.1 festgeschriebene Konvention
 * (select-exercises.js, testRepositoryRelativeOutput): "work/episode.json"
 * meint ueberall dasselbe Verzeichnis.
 */
function resolvePipelinePath(value) {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(REPO_ROOT, value);
}

/*
 * Lesbarer Pfad fuer Manifeste: innerhalb des Repos relativ (stabil im Diff),
 * ausserhalb absolut statt "../../../../tmp/clip.mp4".
 */
function reportPath(value) {
  const absolute = resolvePipelinePath(value);
  const relative = path.relative(REPO_ROOT, absolute);
  if (relative.startsWith("..")) return absolute.split(path.sep).join("/");
  return relative.split(path.sep).join("/");
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

/*
 * P7.4.1 — buildDocument() injiziert neben der Aufwahl auch die Zeitachse der
 * gewaehlten Hook-Vorlage. Ohne timeline bleibt das Feld "{}" und die Buehne
 * faellt auf den Standardablauf zurueck.
 */
function buildDocument(template, cssBase, cssActive, appBase, episode, index, plan) {
  const payload = JSON.stringify(Object.assign({}, episode, { previewIndex: index }));
  const marker = '<script id="episode-data" type="application/json">{}</script>';
  const timelineMarker = '<script id="timeline-data" type="application/json">{}</script>';
  if (!template.includes(marker)) fail("Template enthält keinen episode-data-Platzhalter.");
  if (!template.includes(timelineMarker)) fail("Template enthält keinen timeline-data-Platzhalter.");
  if (!template.includes("<!-- APP_STYLES -->") || !template.includes("<!-- APP_SCRIPT -->")) {
    fail("Template enthält nicht alle Inline-Platzhalter.");
  }

  const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
  const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");
  const escapeJson = function (value) {
    return value.replace(/&/g, "\\u0026").replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
      .replace(LINE_SEPARATOR, "\\u2028").replace(PARAGRAPH_SEPARATOR, "\\u2029");
  };

  /*
   * Nur die Felder, die die Buehne braucht. Die komplette Zeitachse waere
   * duplizierte Wahrheit und muesste an zwei Stellen gepflegt werden.
   */
  const stagePlan = {
    hook: plan.hook,
    hookLabel: plan.hookLabel,
    eyebrow: plan.eyebrow,
    hookLine: plan.hookLine,
    pauseMode: plan.pauseMode,
    pauseText: plan.pauseText,
    pauseSeconds: plan.pauseSeconds,
    countdownSeconds: plan.countdownSeconds
  };

  let html = template
    .replace(marker, '<script id="episode-data" type="application/json">'
      + escapeJson(payload) + "</script>")
    .replace(timelineMarker, '<script id="timeline-data" type="application/json">'
      + escapeJson(JSON.stringify(stagePlan)) + "</script>")
    .replace("<!-- APP_STYLES -->", "<style>\n" + cssBase + "\n" + cssActive + "\n</style>")
    .replace("<!-- APP_SCRIPT -->", "<script>\n" + appBase + "\n</script>");

  /*
   * Kommentare zählen nicht: ein erläuternder Hinweis im CSS darf ein
   * Element nennen, ohne es einzubinden. Geprüft wird nur ausführbarer Code.
   */
  const executableHtml = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  if (/<script[^>]+src=|<link[^>]+(?:href|src)=(?!\s*["']data:)[^>]+>|<img[^>]+src=/i.test(executableHtml)) {
    fail("Szene enthält nach der Inline-Erzeugung noch externe Ressourcen.");
  }
  const executableAppBase = appBase
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  if (/app-active\.js|backend\/|localStorage|sessionStorage|indexedDB|sendBeacon|XMLHttpRequest|WebSocket/i.test(executableAppBase)) {
    fail("app-base.js enthält unerlaubte App-, Backend- oder Storage-Logik.");
  }
  return html;
}


function writeAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = filePath + ".tmp-" + process.pid;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, filePath);
}

/*
 * Startet eine abgeschirmte Chrome-Szene: eigenes Profil, jede Anfrage
 * außerhalb der Szene wird abgebrochen und protokolliert.
 */
async function startIsolatedScene(options, html, view) {
  const chrome = options.chrome || findChrome();
  if (!chrome) fail("Kein Chrome/Chromium gefunden. Setze CHROME_PATH oder --chrome.");
  const collectors = { blockedRequests: [], pageErrors: [], consoleErrors: [] };
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-p7-browser-"));
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      userDataDir: userDataDir,
      args: LAUNCH_ARGS
    });
    const page = await browser.newPage();
    await page.setViewport({
      width: view.width,
      height: view.height,
      deviceScaleFactor: 1
    });
    page.setDefaultTimeout(options.timeout);
    page.setDefaultNavigationTimeout(options.timeout);
    await page.setRequestInterception(true);
    page.on("request", function (request) {
      const url = request.url();
      if (url === SCENE_ORIGIN) {
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
      collectors.blockedRequests.push(url);
      request.abort("blockedbyclient");
    });
    page.on("pageerror", function (error) { collectors.pageErrors.push(error.message); });
    page.on("console", function (message) {
      if (message.type() === "error") collectors.consoleErrors.push(message.text());
    });
    await page.goto(SCENE_ORIGIN, { waitUntil: "domcontentloaded", timeout: options.timeout });
    return { browser: browser, userDataDir: userDataDir, page: page, collectors: collectors };
  } catch (error) {
    if (browser) await browser.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

async function closeIsolatedScene(scene) {
  if (scene && scene.browser) await scene.browser.close();
  if (scene && scene.userDataDir) fs.rmSync(scene.userDataDir, { recursive: true, force: true });
}

function assertNoSceneErrors(collectors) {
  if (collectors.blockedRequests.length) {
    fail("Browser hat externe Ressourcen angefordert: " + collectors.blockedRequests.join(", "));
  }
  if (collectors.pageErrors.length || collectors.consoleErrors.length) {
    fail("Browserfehler: " + collectors.pageErrors.concat(collectors.consoleErrors).join(" | "));
  }
}

module.exports = {
  REPO_ROOT: REPO_ROOT,
  PIPELINE_ROOT: PIPELINE_ROOT,
  SCENE_ORIGIN: SCENE_ORIGIN,
  LAUNCH_ARGS: LAUNCH_ARGS,
  fail: fail,
  sleep: sleep,
  findChrome: findChrome,
  resolvePipelinePath: resolvePipelinePath,
  reportPath: reportPath,
  isChoiceExercise: isChoiceExercise,
  readEpisode: readEpisode,
  buildDocument: buildDocument,
  writeAtomic: writeAtomic,
  startIsolatedScene: startIsolatedScene,
  closeIsolatedScene: closeIsolatedScene,
  assertNoSceneErrors: assertNoSceneErrors
};
