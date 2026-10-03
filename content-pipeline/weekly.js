#!/usr/bin/env node
"use strict";

/*
 * weekly.js — Wochendurchlauf der Videowerkstatt (7.5).
 *
 * Bisher war der Ablauf manuell und in fünf Einzelbefehle zerlegt, die man
 * sich merken muss. Das Skript macht daraus einen Schritt:
 *
 *   1. Hook der Woche bestimmen (Rotation ueber alle fuenf Vorlagen)
 *   2. Clip rendern        (run-pipeline.js, Seed aus der ISO-Woche)
 *   3. In die Queue legen  (queue-episode.js)
 *   4. Freigabe-Server starten
 *   5. Mail mit Freigabe-Link, Caption und Hashtags schicken
 *
 * Gepostet wird weiterhin MANUELL — das Skript macht nur fertig, was man
 * fuer das Posten braucht. Der Freigabeschritt bleibt zwingend
 * (ROADMAP 7.4, "Bewusste Reihenfolge" Punkt 2).
 *
 * Mail: Resend, derselbe Weg wie scripts/weekly_summary.py. Schlaegt sie
 * fehl, ist das KEIN Fehler — der Freigabe-Link wird immer ausgegeben.
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PIPELINE = __dirname;
const REPO = path.join(PIPELINE, "..");
const MAIL_TO_DEFAULT = "andybrandy@gmx.at";
const PORT_DEFAULT = 8787;

/* Feste Reihenfolge der Hooks fuer die Wochenrotation. Die Liste ist
 * bewusst fest und nicht aus timeline.js abgeleitet: die Rotation soll
 * sich nicht still verschieben, wenn jemand eine Vorlage umbenennt. */
const ROTATION = ["countdown", "vorher-nachher", "frage", "streak", "erwachsenen"];

function usage() {
  return [
    "Verwendung: node content-pipeline/weekly.js [Optionen]",
    "",
    "  --hook <name>     Hook dieser Woche (Vorgabe: aus der Wochenrotation)",
    "  --index <n>       Aufgabe aus der Auswahl (Standard: 0)",
    "  --count <n>       Aufgaben fuer die Auswahl (Standard: 3)",
    "  --seed <text>     Seed (Vorgabe: aus der ISO-Woche)",
    "  --port <n>        Port des Freigabe-Servers (Standard: " + PORT_DEFAULT + ")",
    "  --keine-mail      Mail bewusst ueberspringen",
    "  --dry-run         Zeigt nur, was passieren wuerde — rendert nichts",
    "  --hilfe           Diese Hilfe"
  ].join("\n");
}

function fail(message) {
  process.stderr.write("FEHLER: " + message + "\n");
  process.exit(1);
}

/* ISO-Kalenderwoche. Der Freitag, an dem gepostet wird, gehoert in
 * vielen Jahren zur Vorwoche — deshalb wird nicht ueber "heute"
 * rotiert, sondern ueber die Kalenderwoche, die ein Kalender leicht
 * nachrechnen kann. */
function isoWeek(datum) {
  const d = new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tag);
  const jahrStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - jahrStart) / 86400000 + 1) / 7);
}

function parseArgs(argv) {
  const opts = {
    hook: "", index: 0, count: 3, seed: "",
    port: PORT_DEFAULT, mail: true, dryRun: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === "--hilfe" || a === "-h" || a === "--help") { process.stdout.write(usage() + "\n"); process.exit(0); }
    else if (a === "--hook") { opts.hook = v; i += 1; }
    else if (a === "--index") { opts.index = Number(v); i += 1; }
    else if (a === "--count") { opts.count = Number(v); i += 1; }
    else if (a === "--seed") { opts.seed = v; i += 1; }
    else if (a === "--port") { opts.port = Number(v); i += 1; }
    else if (a === "--keine-mail") { opts.mail = false; }
    else if (a === "--dry-run") { opts.dryRun = true; }
    else fail("Unbekannte Option " + a + "\n\n" + usage());
  }
  if (!Number.isInteger(opts.index) || opts.index < 0) fail("--index muss eine ganze Zahl ab 0 sein.");
  if (!Number.isInteger(opts.count) || opts.count < 3 || opts.count > 5) fail("--count muss 3 bis 5 sein (Auswahl macht das so).");
  if (!Number.isInteger(opts.port) || opts.port < 1024 || opts.port > 65535) fail("--port muss zwischen 1024 und 65535 liegen.");
  return opts;
}
const https = require("node:https");

/*
 * Mailweg: Resend, wie im Wochenbericht. Schluessel kommt aus der
 * Umgebung oder aus einer lokalen, NICHT eingecheckten Datei — so muss
 * man ihn nicht in jeder Shell neu eintragen, und er landet nie im Repo.
 */
const KEY_DATEI = path.join(PIPELINE, ".mail-key");

function mailKey() {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY.trim();
  try {
    const inhalt = fs.readFileSync(KEY_DATEI, "utf8").trim();
    if (inhalt) return inhalt.split("\n")[0].trim();
  } catch (error) {
    /* Datei fehlt — dann eben ohne Mail weiter. */
  }
  return "";
}

function mailEmpfaenger() {
  return (process.env.MAIL_TO || MAIL_TO_DEFAULT).trim();
}

function mailSenden(betreff, text) {
  const key = mailKey();
  if (!key) {
    process.stdout.write(
      "\n⚠️  KEINE MAIL GESENDET — kein Resend-Schlüssel gefunden.\n" +
      "    Der Freigabe-Link steht oben. Lege den Schlüssel hier ab:\n" +
      "      echo -n 're_...' > " + KEY_DATEI + "\n" +
      "    (Die Datei steht in .gitignore. Empfänger: " + mailEmpfaenger() + ")\n");
    return Promise.resolve(false);
  }
  const inhalt = JSON.stringify({
    from: "onboarding@resend.dev",
    to: [mailEmpfaenger()],
    subject: betreff,
    text: text
  });
  return new Promise(function (fertig) {
    const anfrage = https.request({
      hostname: "api.resend.com",
      path: "/emails",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(inhalt)
      }
    }, function (antwort) {
      let daten = "";
      antwort.on("data", function (t) { daten += t; });
      antwort.on("end", function () {
        if (antwort.statusCode >= 200 && antwort.statusCode < 300) {
          process.stdout.write("✓ Mail an " + mailEmpfaenger() + " geschickt (" + antwort.statusCode + ")\n");
          fertig(true);
        } else {
          /* 403 heisst fast immer: Absender nicht freigegeben. */
          process.stdout.write("✗ Mail fehlgeschlagen (" + antwort.statusCode + "): " + daten.slice(0, 200) + "\n");
          process.stdout.write("  Der Freigabe-Link oben gilt trotzdem.\n");
          fertig(false);
        }
      });
    });
    anfrage.on("error", function (f) {
      process.stdout.write("✗ Mail nicht erreichbar: " + f.message + "\n  Der Freigabe-Link oben gilt trotzdem.\n");
      fertig(false);
    });
    anfrage.write(inhalt);
    anfrage.end();
  });
}

/* Wartet, bis der Freigabe-Server wirklich lauscht. Sonst geht die Mail
 * raus, bevor der Server bereit ist, und der Klick landet im Leeren. */
function warteAufServer(port, versuche) {
  const n = versuche === undefined ? 40 : versuche;
  return new Promise(function (fertig) {
    const anfrage = http.get({ host: "127.0.0.1", port: port, path: "/", timeout: 800 }, function (r) {
      r.resume(); fertig(true);
    });
    anfrage.on("error", function () {
      if (n <= 0) { fertig(false); return; }
      setTimeout(function () { fertig(warteAufServer(port, n - 1)); }, 250);
    });
    anfrage.on("timeout", function () { anfrage.destroy(); });
  });
}

/* Ein Schritt der Kette. stdout wird durchgereicht, damit man beim
 * Rendern sieht, was passiert — das dauert je nach Hook gut eine Minute. */
function schritt(name, skript, args) {
  process.stdout.write("\n=== " + name + " ===\n");
  const r = childProcess.spawnSync(process.execPath, [path.join(PIPELINE, skript)].concat(args), {
    cwd: REPO,
    stdio: "inherit"
  });
  if (r.status !== 0) fail(name + " ist fehlgeschlagen — es geht nichts in die Queue.");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const jetzt = new Date();
  const woche = isoWeek(jetzt);
  const hook = opts.hook || ROTATION[woche % ROTATION.length];
  const seed = opts.seed || ("woche-" + jetzt.getUTCFullYear() + "-W" + String(woche).padStart(2, "0"));

  const timeline = require(path.join(PIPELINE, "lib/timeline.js"));
  if (!timeline.HOOK_IDS.includes(hook)) {
    fail("Unbekannte Hook-Vorlage \"" + hook + "\". Erlaubt sind: " + timeline.HOOK_IDS.join(", "));
  }

  process.stdout.write("═══ Wochendurchlauf ═══\n");
  process.stdout.write("  Kalenderwoche : " + jetzt.getUTCFullYear() + "-W" + String(woche).padStart(2, "0") + "\n");
  process.stdout.write("  Hook          : " + hook + "\n");
  process.stdout.write("  Seed          : " + seed + "  (deterministisch — gleiche Woche = gleicher Clip)\n");
  process.stdout.write("  Auswahl       : " + opts.count + " Aufgaben, davon Index " + opts.index + "\n");

  if (opts.dryRun) {
    process.stdout.write("\n--dry-run: es wird nichts gerendert und nichts gestartet.\n");
    process.stdout.write("Befehl waere:\n  node weekly.js --hook " + hook + " --seed " + seed + "\n");
    return;
  }

  /* 1 + 2: Auswahl, Frames, Montage, Gegenprobe. */
  schritt("1/3 Rendern", "run-pipeline.js", [
    "--hook", hook, "--seed", seed,
    "--count", String(opts.count), "--index", String(opts.index)
  ]);

  /* 3: In die Queue. Erst danach gibt es etwas freizugeben. */
  schritt("2/3 In die Queue", "queue-episode.js", []);

  /* Aus der Queue lesen: Caption und Hashtags gehoeren in die Mail,
   * sonst muesste man sie zum Posten doch wieder nachschlagen. */
  const queueDir = path.join(PIPELINE, "work", "queue");
  let neuester = null;
  try {
    const eintraege = fs.readdirSync(queueDir)
      .map((n) => ({ n, t: fs.statSync(path.join(queueDir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (eintraege.length) neuester = path.join(queueDir, eintraege[0].n, "episode.json");
  } catch (error) {
    fail("Queue-Verzeichnis nicht lesbar: " + error.message);
  }
  let eintrag = {};
  try {
    const roh = JSON.parse(fs.readFileSync(neuester, "utf8"));
    eintrag = roh.episode || roh;
  } catch (error) {
    process.stdout.write("Hinweis: Queue-Eintrag nicht lesbar (" + error.message + ").\n");
  }

  /* 4: Freigabe-Server. Der Token ist fest, damit der Link aus der Mail
   * auch dann stimmt, wenn der Server neu gestartet wird. */
  process.stdout.write("\n=== 3/3 Freigabe-Server ===\n");
  const token = "woche-" + seed;
  const server = childProcess.spawn(process.execPath, [
    path.join(PIPELINE, "review-server.js"), "--port", String(opts.port), "--token", token
  ], { cwd: REPO, stdio: ["ignore", "pipe", "inherit"] });

  const fertig = warteAufServer(opts.port);
  server.on("exit", function (code) {
    if (code !== 0 && code !== null) {
      process.stderr.write("\nFreigabe-Server beendet sich (Code " + code + ") — ist Port " + opts.port + " belegt?\n");
    }
  });
  /* Ctrl+C beendet auch den Server, sonst laeuft er als Waise weiter. */
  process.on("SIGINT", function () {
    server.kill("SIGINT");
    process.exit(0);
  });

  fertig.then(function (bereit) {
    const link = "http://localhost:" + opts.port + "/?token=" + token;
    process.stdout.write("\n");
    process.stdout.write("══════════════════════════════════════════\n");
    process.stdout.write(" Freigabe öffnen:  " + link + "\n");
    process.stdout.write(" MP4 zum Hochladen: " + path.join(PIPELINE, "work", "queue", path.basename(path.dirname(neuester || "x")), "clip.mp4") + "\n");
    if (eintrag && eintrag.slug) process.stdout.write(" Episode:         " + eintrag.slug + "\n");
    process.stdout.write("══════════════════════════════════════════\n");

    if (!bereit) {
      process.stdout.write("\n⚠️  Server hat nicht auf Port " + opts.port + " geantwortet.\n");
      process.stdout.write("   Vermutlich läuft schon einer. Freigabe dann mit:\n");
      process.stdout.write("   npm run review\n");
    }

    if (!opts.mail) {
      process.stdout.write("\n--keine-mail: Mail bewusst übersprungen.\n");
      if (bereit) server.unref();
      return;
    }

    const clipPfad = path.join(PIPELINE, "work", "queue", path.basename(path.dirname(neuester || "x")), "clip.mp4");
    const text = [
      "Hallo Andy,",
      "",
      "Die Videos dieser Woche sind gerendert und warten auf Freigabe.",
      "",
      "  Kalenderwoche : " + jetzt.getUTCFullYear() + "-W" + String(woche).padStart(2, "0"),
      "  Hook          : " + hook,
      "  Clip          : " + clipPfad,
      "",
      "FREIGABE: " + link,
      "",
      "Caption:",
      eintrag.caption || "(siehe Review-Seite)",
      "",
      "Hashtags:",
      Array.isArray(eintrag.hashtags) ? eintrag.hashtags.join(" ") : "(siehe Review-Seite)",
      "",
      "Ablauf: freigeben, dann manuell auf YouTube Shorts, TikTok und",
      "Instagram Reels posten. Reichweite nach 24 h notieren.",
      "",
      "— Mathemit Wochenlauf"
    ].join("\n");

    mailSenden("🎬 Neue Videos zur Freigabe – " + jetzt.getUTCFullYear() + "-W" + String(woche).padStart(2, "0") + " (" + hook + ")", text)
      .then(function () {
        if (bereit) server.unref();
      });
  });
}

if (require.main === module) main();

module.exports = {
  isoWeek: isoWeek,
  ROTATION: ROTATION,
  parseArgs: parseArgs
};