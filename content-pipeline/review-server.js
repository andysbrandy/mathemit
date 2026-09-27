#!/usr/bin/env node
"use strict";

/*
 * P7.4.6 (vorbereitet) — Lokale Freigabe per Link.
 *
 * Nach dem Queue-Lauf liegt fertiges Material auf der Platte. Bis das Posten
 * automatisiert wird, muss dieses Material angesehen und freigegeben werden.
 * Dieses Skript stellt dafuer einen kleinen Server bereit, der auf einem
 * Rechner im eigenen Netz laeuft: er zeigt alle Queue-Episoden mit Video,
 * Caption und Hashtags und nimmt die Freigabe per Klick entgegen.
 *
 * Bewusste Grenzen — das ist kein Webserver und soll keiner werden:
 *
 * - Er bindet an alle Schnittstellen, damit der Link auch vom Handy im
 *   selben WLAN erreichbar ist. Das ist nur sicher, solange das Netz privat
 *   ist; das Netz ist ausdruecklich gemeint.
 * - Es gibt keine Anmeldung, weil es keine Nutzer gibt. Jeder im Netz darf
 *   freigeben. Deshalb wird der Token beim Start erzeugt und muss im Link
 *   mitgeschickt werden: ohne ihn werden keine Aenderungen angenommen.
 * - Es wird nichts veroeffentlicht. Der Server liest und schreibt ausschliesslich
 *   innerhalb von work/queue/ und ruft keine Plattform auf.
 * - Er beendet sich mit Strg-C. Es gibt keinen Dienst und keinen Watchdog.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const scene = require("./lib/isolated-scene");
const queue = require("./queue-episode");

const fail = scene.fail;
const resolvePipelinePath = scene.resolvePipelinePath;

const DEFAULT_QUEUE = "content-pipeline/work/queue";
const DEFAULT_PORT = 8787;
const MANIFEST_NAME = "episode.json";
const VIDEO_NAME = "clip.mp4";

/* Nur diese Endpunkte. Alles andere wird abgelehnt statt "irgendwie" beantwortet. */
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4"
};

function usage() {
  return [
    "Verwendung: node content-pipeline/review-server.js [Optionen]",
    "",
    "  --queue <verzeichnis>  Zu pruefende Queue (Standard: " + DEFAULT_QUEUE + ")",
    "  --port <nummer>        Port (Standard: " + DEFAULT_PORT + ")",
    "  --host <adresse>       Nur an diese Adresse binden (Standard: alle)",
    "  --token <text>         Freigabe-Token; ohne Angabe wird eines erzeugt",
    "  --help                 Diese Hilfe anzeigen"
  ].join("\n");
}

function parseArgs(argv) {
  const opts = { queue: DEFAULT_QUEUE, port: DEFAULT_PORT, host: "0.0.0.0", token: "" };
  const known = ["--queue", "--port", "--host", "--token"];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (!known.includes(arg)) fail("Unbekannte Option: " + arg + "\n\n" + usage());
    if (i + 1 >= argv.length) fail("Für " + arg + " fehlt ein Wert.");
    const value = argv[++i];
    if (arg === "--queue") opts.queue = value;
    else if (arg === "--port") opts.port = Number(value);
    else if (arg === "--host") opts.host = value;
    else if (arg === "--token") opts.token = value;
  }
  if (!Number.isInteger(opts.port) || opts.port < 1024 || opts.port > 65535) {
    fail("Port muss eine ganze Zahl zwischen 1024 und 65535 sein.");
  }
  opts.queue = resolvePipelinePath(opts.queue);
  if (!opts.token) opts.token = crypto.randomBytes(9).toString("base64url");
  return opts;
}


/*
 * Der Token muss im Link mitkommen. Ohne ihn wird nichts angenommen — das
 * ist der einzige Schutz, den dieser Server kennt, und mehr soll er nicht
 * vortaeuschen.
 */
function tokenOk(url, opts) {
  const given = url.searchParams.get("token");
  if (!given) return false;
  /* Vergleich in konstanter Zeit: ein Timing-Leak ist hier unwahrscheinlich,
     aber der Aufwand ist eine Zeile. */
  const a = Buffer.from(given);
  const b = Buffer.from(opts.token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

/*
 * Slugs werden aus dem Dateisystem gelesen und in HTML eingesetzt. Damit kein
 * fremder Pfad oder eine fremde Datei entsteht, wird jeder Slug gegen das
 * erlaubte Muster geprueft und jeder Zugriff auf work/queue/ begrenzt.
 */
function validSlug(slug) {
  return /^[A-Za-z0-9._-]{1,64}$/.test(slug) && slug.indexOf("..") === -1;
}

function episodeDir(opts, slug) {
  if (!validSlug(slug)) fail("Ungueltiger Name: " + slug);
  const dir = path.join(opts.queue, slug);
  if (path.dirname(path.resolve(dir)) !== path.resolve(opts.queue)) {
    fail("Name zeigt aus der Queue heraus: " + slug);
  }
  return dir;
}

function readManifest(opts, slug) {
  const file = path.join(episodeDir(opts, slug), MANIFEST_NAME);
  if (!fs.existsSync(file)) fail("Keine Queue-Episode in " + slug);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function page(opts, body) {
  return [
    "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<title>Mathemit — Freigabe</title><style>",
    "body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f2f5f9;color:#1f2e45;margin:0;padding:24px}",
    "h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:0 0 12px}",
    ".meta{color:#5b6b82;font-size:14px;margin-bottom:20px}",
    ".card{background:#fff;border-radius:16px;padding:20px;margin-bottom:20px;box-shadow:0 1px 4px rgba(31,46,69,.10)}",
    "video{width:100%;max-width:360px;display:block;border-radius:12px;background:#000}",
    "pre{white-space:pre-wrap;font-family:inherit;font-size:14px;background:#f7f9fc;padding:12px;border-radius:10px}",
    ".tag{display:inline-block;background:#fdf0d5;color:#8a5a0b;padding:4px 10px;border-radius:999px;margin:0 6px 6px 0;font-size:13px;font-weight:600}",
    "button{background:#1f7a4d;color:#fff;border:0;padding:12px 20px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}",
    "ul{list-style:none;padding:0;margin:0}a{color:#1f5fa8}",
    ".bereit{color:#1f7a4d;font-weight:700}.unvollstaendig{color:#b4341f;font-weight:700}",
    "</style></head><body>" + body + "</body></html>"
  ].join("");
}

function renderIndex(opts) {
  const rows = queue.list(opts.queue);
  if (!rows.length) {
    return page(opts, "<h1>Mathemit — Freigabe</h1><div class=\"card\">"
      + "<p>Die Queue ist leer. Erst mit <code>npm run queue</code> fuellen.</p></div>");
  }
  const items = rows.map(function (row) {
    return "<li><a href=\"/e/" + encodeURIComponent(row.slug) + "?token=" + encodeURIComponent(opts.token)
      + "\">" + escapeHtml(row.slug) + "</a> — <span class=\"" + row.status + "\">"
      + escapeHtml(row.status) + "</span>"
      + (row.gaps.length ? " <em>(" + escapeHtml(row.gaps.join("; ")) + ")</em>" : "") + "</li>";
  }).join("");
  return page(opts, "<h1>Mathemit — Freigabe</h1>"
    + "<p class=\"meta\">" + rows.length + " Episode(en). Nichts davon wird veroeffentlicht; "
    + "das Posten bleibt manuell.</p><div class=\"card\"><ul>" + items + "</ul></div>");
}

function renderEpisode(opts, slug) {
  const record = readManifest(opts, slug);
  const hasVideo = fs.existsSync(path.join(episodeDir(opts, slug), record.artifacts.video));
  const released = record.status === "freigegeben";
  /* Freigabe nur anbieten, wenn die Episode vollstaendig ist — dieselbe
     Bedingung, die queue-episode.js bei --release durchsetzt. */
  const canRelease = record.status === "bereit" && hasVideo;

  const tags = record.hashtags.map(function (tag) {
    return "<span class=\"tag\">" + escapeHtml(tag) + "</span>";
  }).join("");

  const action = released
    ? "<p class=\"bereit\">Freigegeben am " + escapeHtml(String(record.releasedAt)) + "</p>"
    : canRelease
      ? "<form method=\"post\" action=\"/release\">"
        + "<input type=\"hidden\" name=\"token\" value=\"" + escapeHtml(opts.token) + "\">"
        + "<input type=\"hidden\" name=\"slug\" value=\"" + escapeHtml(slug) + "\">"
        + "<button type=\"submit\">Freigeben</button></form>"
      : "<p class=\"unvollstaendig\">Nicht freigabefaehig: "
        + escapeHtml((record.gaps || []).join("; ") || "unbekannte Luecke") + "</p>";

  return page(opts,
    "<h1>" + escapeHtml(slug) + "</h1>"
    + "<p class=\"meta\"><a href=\"/?token=" + encodeURIComponent(opts.token) + "\">zurueck</a></p>"
    + "<div class=\"card\"><h2>Video</h2>"
    + (hasVideo
      ? "<video controls playsinline preload=\"metadata\" src=\"/v/" + encodeURIComponent(slug)
        + "?token=" + encodeURIComponent(opts.token) + "\"></video>"
      : "<p class=\"unvollstaendig\">MP4 fehlt in dieser Episode.</p>")
    + "</div>"
    + "<div class=\"card\"><h2>Caption</h2><pre>" + escapeHtml(record.caption) + "</pre></div>"
    + "<div class=\"card\"><h2>Hashtags</h2><div>" + tags + "</div></div>"
    + "<div class=\"card\"><h2>Technik</h2><p class=\"meta\">"
    + escapeHtml(record.technical.stage.width + "x" + record.technical.stage.height)
    + " · " + escapeHtml(String(record.technical.durationSeconds)) + " s · "
    + escapeHtml(String(record.technical.frameCount)) + " Frames · Seed "
    + escapeHtml(String(record.source.seed)) + "</p>"
    + "<p class=\"" + record.status + "\">Status: " + escapeHtml(record.status) + "</p>"
    + action + "</div>");
}

/* Nur MP4 wird ausgeliefert — keine beliebigen Dateien aus dem Queue-Ordner. */
function sendVideo(opts, res, slug) {
  const dir = episodeDir(opts, slug);
  const file = path.join(dir, VIDEO_NAME);
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("kein MP4 in dieser Episode");
    return;
  }
  const stat = fs.statSync(file);
  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Content-Length": stat.size,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(file).pipe(res);
}

function sendHtml(res, status, body) {
  res.writeHead(status, { "Content-Type": CONTENT_TYPES[".html"], "Cache-Control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve) {
    const chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
      /* Obergrenze: ein Freigabeformular ist klein. */
      if (chunks.reduce(function (sum, c) { return sum + c.length; }, 0) > 64 * 1024) {
        req.destroy();
      }
    });
    req.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", function () { resolve(""); });
  });
}

function createServer(opts) {
  return http.createServer(async function (req, res) {
    const url = new URL(req.url, "http://localhost");

    /*
     * Ohne Token wird nichts angezeigt und nichts geaendert.
     *
     * Beim GET steht der Token in der Adresse, beim POST im Formular — der
     * muss vorher aus dem Body gelesen werden. Sonst wuerde jedes Formular
     * abgewiesen und die Freigabe waere unmoeglich.
     */
    let formToken = null;
    let form = null;
    if (req.method === "POST") {
      form = new URLSearchParams(await readBody(req));
      formToken = form.get("token");
    }
    if (!tokenOk(url, opts) && formToken !== opts.token) {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/e/"))) {
        sendHtml(res, 401, page(opts,
          "<h1>Freigabe</h1><div class=\"card\"><p>Dieser Link fehlt der Token. "
          + "Der vollstaendige Link steht im Terminal, mit dem der Server gestartet wurde.</p></div>"));
        return;
      }
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("kein gueltiger Token");
      return;
    }

    try {
      if (req.method === "GET" && url.pathname === "/") {
        sendHtml(res, 200, renderIndex(opts));
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/e/")) {
        sendHtml(res, 200, renderEpisode(opts, decodeURIComponent(url.pathname.slice(3))));
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/v/")) {
        sendVideo(opts, res, decodeURIComponent(url.pathname.slice(3)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/release") {
        /* Der Body wurde oben bereits gelesen und geprueft. */
        const slug = form.get("slug") || "";
        /*
         * Die Freigabe laeuft ueber genau dieselbe Funktion wie --release an
         * der Kommandozeile. Der Server kann also nichts freigeben, was das
         * Skript nicht auch freigeben wuerde.
         */
        const record = queue.release(episodeDir(opts, slug));
        sendHtml(res, 200, renderEpisode(opts, record.slug));
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("nicht gefunden");
    } catch (error) {
      sendHtml(res, 400, page(opts,
        "<h1>Nicht moeglich</h1><div class=\"card\"><p class=\"unvollstaendig\">"
        + escapeHtml(error && error.message ? error.message : String(error)) + "</p>"
        + "<p><a href=\"/?token=" + encodeURIComponent(opts.token) + "\">zurueck</a></p></div>"));
    }
  });
}

/* Alle IPv4-Adressen des Rechners — der Link soll auch vom Handy im WLAN gelten. */
function localAddresses() {
  const found = [];
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach(function (name) {
    (interfaces[name] || []).forEach(function (entry) {
      if (entry.family === "IPv4" && !entry.internal) found.push(entry.address);
    });
  });
  return found;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.queue)) {
    process.stdout.write("Hinweis: " + opts.queue + " existiert noch nicht — die Seite wird leer sein.\n");
  }
  const server = createServer(opts);
  server.listen(opts.port, opts.host, function () {
    process.stdout.write("\nMathemit — Freigabe laeuft\n\n");
    process.stdout.write("  http://localhost:" + opts.port + "/?token=" + opts.token + "\n");
    localAddresses().forEach(function (address) {
      process.stdout.write("  http://" + address + ":" + opts.port + "/?token=" + opts.token + "  (Handy im WLAN)\n");
    });
    process.stdout.write("\nNur im eigenen Netz verwenden. Nichts wird veroeffentlicht; "
      + "das Posten bleibt manuell. Beenden mit Strg-C.\n\n");
  });
  server.on("error", function (error) {
    process.stderr.write("FEHLER: " + error.message + "\n");
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs: parseArgs,
  tokenOk: tokenOk,
  validSlug: validSlug,
  episodeDir: episodeDir,
  escapeHtml: escapeHtml,
  createServer: createServer,
  localAddresses: localAddresses
};
