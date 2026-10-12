#!/usr/bin/env node
"use strict";

/*
 * weekly.js — Wochendurchlauf der Videowerkstatt (7.5), plus Tagesautomatik.
 *
 * Bisher war der Ablauf manuell und in fünf Einzelbefehle zerlegt, die man
 * sich merken muss. Das Skript macht daraus einen Schritt:
 *
 *   1. Hook bestimmen (Wochenrotation, oder Tagesrotation bei --daily)
 *   2. Clip rendern        (run-pipeline.js, Seed aus Woche bzw. Datum)
 *   3. In die Queue legen  (queue-episode.js)
 *   4. Freigabe-Server starten — oder, bei --kein-server, auf den schon
 *      laufenden persistenten Server verweisen (launchd)
 *   5. Mail mit Freigabe-Link, Caption und Hashtags schicken
 *
 * Gepostet wird weiterhin MANUELL — das Skript macht nur fertig, was man
 * fuer das Posten braucht. Der Freigabeschritt bleibt zwingend
 * (ROADMAP 7.4, "Bewusste Reihenfolge" Punkt 2).
 *
 * Der Freigabe-Link zeigt per Vorgabe auf den Tailscale-DNS-Namen dieses
 * Macs, damit er auch vom Handy und ausser Haus aufgeht. Faellt Tailscale
 * aus, zeigt er auf localhost (dann nur am Mac nutzbar).
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
const MAIL_TO_DEFAULT = "mathemit@andybrandy.at";
const PORT_DEFAULT = 8787;
const REVIEW_TOKEN_DATEI = path.join(PIPELINE, ".review-token");

/* Feste Reihenfolge der Hooks fuer die Wochenrotation. Die Liste ist
 * bewusst fest und nicht aus timeline.js abgeleitet: die Rotation soll
 * sich nicht still verschieben, wenn jemand eine Vorlage umbenennt.
 * Dasselbe Array treibt auch die Tagesrotation (--daily) an. */
const ROTATION = ["countdown", "vorher-nachher", "frage", "streak", "erwachsenen"];

function usage() {
  return [
    "Verwendung: node content-pipeline/weekly.js [Optionen]",
    "",
    "  --hook <name>     Hook dieser Woche (Vorgabe: aus der Wochenrotation)",
    "  --index <n>       Aufgabe aus der Auswahl (Standard: 0)",
    "  --count <n>       Aufgaben fuer die Auswahl (Standard: 3)",
    "  --seed <text>     Seed (Vorgabe: aus der ISO-Woche, bei --daily aus dem Datum)",
    "  --port <n>        Port des Freigabe-Servers (Standard: " + PORT_DEFAULT + ")",
    "  --daily           Tageslauf: eigener Seed pro Tag (tag-YYYY-MM-TT) + eigene",
    "                    Hook-Rotation, damit jeder Tag ein neuer Clip entsteht",
    "  --kein-server     Keinen eigenen Freigabe-Server starten — der laeuft schon",
    "                    dauerhaft (launchd). Link zeigt auf den persistenten Server",
    "  --review-host <h> Hostname fuer den Freigabe-Link (Vorgabe: REVIEW_HOST oder",
    "                    Tailscale-DNS-Name, sonst localhost)",
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
    port: PORT_DEFAULT, mail: true, dryRun: false,
    daily: false, keinServer: false, reviewHost: ""
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
    else if (a === "--daily") { opts.daily = true; }
    else if (a === "--kein-server") { opts.keinServer = true; }
    else if (a === "--review-host") { opts.reviewHost = v; i += 1; }
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

/* Lokales ISO-Datum YYYY-MM-TT (UTC) — Basis fuer den Tages-Seed. */
function isoDate(datum) {
  const y = datum.getUTCFullYear();
  const m = String(datum.getUTCMonth() + 1).padStart(2, "0");
  const d = String(datum.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

/* Tagesrotation: ein Hook pro Kalendertag, deterministisch. Damit entsteht
 * ueber die Woche jeder Hook mehrfach, aber nie derselbe Clip zweimal. */
function tagesHook(datum) {
  const tage = Math.floor(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()) / 86400000);
  return ROTATION[((tage % ROTATION.length) + ROTATION.length) % ROTATION.length];
}

/* Tailscale-DNS-Name dieses Macs, z. B. "macbook-pro.tailf86af0.ts.net".
 * Damit ist der Freigabe-Link aus der Mail auch vom Handy und ausser Haus
 * erreichbar — ohne die Queue oeffentlich zu machen. Leer, wenn Tailscale
 * nicht laeuft oder der CLI fehlt; dann faellt der Link auf localhost. */
function tailscaleDnsName() {
  try {
    const out = childProcess.execSync("tailscale status --json", { timeout: 3000, stdio: ["ignore", "pipe", "ignore"] });
    const status = JSON.parse(out);
    const dns = status && status.Self && status.Self.DNSName ? status.Self.DNSName : "";
    return dns.replace(/\.$/, "");
  } catch (error) {
    return "";
  }
}

/* Hostname fuer den Freigabe-Link: --review-host, dann REVIEW_HOST, dann
 * Tailscale-DNS-Name, zuletzt localhost. */
function freigabeHost(opts) {
  if (opts.reviewHost) return opts.reviewHost.replace(/\/+$/, "");
  if (process.env.REVIEW_HOST) return process.env.REVIEW_HOST.trim().replace(/\/+$/, "");
  return tailscaleDnsName() || "localhost";
}

function freigabeLink(port, token, host) {
  return "http://" + host + ":" + port + "/?token=" + token;
}

/* Fixer Freigabe-Token fuer den persistenten Server (--kein-server). Er muss
 * genau dem Token entsprechen, mit dem der launchd-Dienst den Server startet.
 * Quelle: --token wird hier nicht gebraucht; REVIEW_TOKEN oder .review-token. */
function reviewTokenDatei() {
  if (process.env.REVIEW_TOKEN) return process.env.REVIEW_TOKEN.trim();
  try {
    const inhalt = fs.readFileSync(REVIEW_TOKEN_DATEI, "utf8").trim();
    if (inhalt) return inhalt.split("\n")[0].trim();
  } catch (error) {
    /* Datei fehlt — dann ohne festen Token weiter. */
  }
  return "";
}

/* Einfacher, prozessuebergreifender Lauf-Schutz. Der Tageslauf (launchd) soll
 * nicht gleichzeitig mit einem manuellen Lauf in dieselben work/-Ordner
 * schreiben. Die Lock-Datei wird exklusiv angelegt; existiert sie bereits und
 * ist frisch, wird der Lauf mit einem Log uebersprungen. Eine aeltere Lock
 * (Rest eines abgestuerzten Laufs) gilt als veraltet und wird ersetzt. */
const LOCK_DATEI = path.join(PIPELINE, "work", ".weekly.lock");
const LOCK_MAX_ALTER_MS = 45 * 60 * 1000;   /* 45 Minuten */

function lockAlterMs() {
  try {
    return Date.now() - fs.statSync(LOCK_DATEI).mtimeMs;
  } catch (error) {
    return Infinity;   /* keine Lock-Datei → frei */
  }
}

/* Gibt true zurueck, wenn der Lauf starten darf; false, wenn schon einer
 * laeuft. Bei true ist die Lock-Datei angelegt. */
function lockErwerben() {
  try { fs.mkdirSync(path.dirname(LOCK_DATEI), { recursive: true }); } catch (error) { /* existiert schon */ }
  if (lockAlterMs() < LOCK_MAX_ALTER_MS) return false;   /* frischer Lauf laeuft */
  /* abgelaufene Rest-Lock wegwerfen, dann frisch anlegen */
  try { fs.unlinkSync(LOCK_DATEI); } catch (error) { /* keine da */ }
  try {
    const fd = fs.openSync(LOCK_DATEI, "wx");
    fs.writeSync(fd, process.pid + "\n");
    fs.closeSync(fd);
    return true;
  } catch (error) {
    return false;   /* exakt in dieser Sekunde hat jemand anders zugegriffen */
  }
}

function lockFreigeben() {
  try { fs.unlinkSync(LOCK_DATEI); } catch (error) { /* schon weg */ }
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
  const hook = opts.hook || (opts.daily ? tagesHook(jetzt) : ROTATION[woche % ROTATION.length]);
  const seed = opts.seed || (opts.daily
    ? ("tag-" + isoDate(jetzt))
    : ("woche-" + jetzt.getUTCFullYear() + "-W" + String(woche).padStart(2, "0")));

  const timeline = require(path.join(PIPELINE, "lib/timeline.js"));
  if (!timeline.HOOK_IDS.includes(hook)) {
    fail("Unbekannte Hook-Vorlage \"" + hook + "\". Erlaubt sind: " + timeline.HOOK_IDS.join(", "));
  }

  process.stdout.write("═══ " + (opts.daily ? "Tagesdurchlauf" : "Wochendurchlauf") + " ═══\n");
  process.stdout.write("  " + (opts.daily ? "Datum" : "Kalenderwoche") + " : "
    + (opts.daily ? isoDate(jetzt) : (jetzt.getUTCFullYear() + "-W" + String(woche).padStart(2, "0"))) + "\n");
  process.stdout.write("  Hook          : " + hook + "\n");
  process.stdout.write("  Seed          : " + seed + "  (deterministisch — gleiche " + (opts.daily ? "Tag" : "Woche") + " = gleicher Clip)\n");
  process.stdout.write("  Auswahl       : " + opts.count + " Aufgaben, davon Index " + opts.index + "\n");

  if (opts.dryRun) {
    process.stdout.write("\n--dry-run: es wird nichts gerendert und nichts gestartet.\n");
    process.stdout.write("Befehl waere:\n  node weekly.js " + (opts.daily ? "--daily " : "") + "--hook " + hook + " --seed " + seed + "\n");
    return;
  }

  /* Lauf-Schutz: laeuft schon ein anderer Lauf (manuell oder ein Tageslauf,
   * der noch nicht fertig ist), wird hier uebersprungen — mit Log, nicht
   * mit Fehler. So kann der Tageslauf gefahrlos taeglich feuern. */
  if (!lockErwerben()) {
    process.stdout.write("\n⏭  Übersprungen: es läuft bereits ein Lauf (Lock " + LOCK_DATEI + ").\n");
    process.stdout.write("   Nichts gerendert, keine Mail. Der laufende Lauf macht seinen eigenen Clip.\n");
    return;
  }
  /* Lock in jedem Fall freigeben, auch bei Fehler/Abbruch. */
  process.on("exit", lockFreigeben);
  process.on("SIGINT", function () { lockFreigeben(); process.exit(130); });
  process.on("SIGTERM", function () { lockFreigeben(); process.exit(143); });

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

  /* 4: Freigabe-Server und Link. Zwei Wege:
   *  - Normal (ohne --kein-server): eigener Server wird hier gestartet und
   *    mit Ctrl+C beendet. Token pro Lauf.
   *  - --kein-server: der Server laeuft schon dauerhaft per launchd. Es wird
   *    keiner gestartet; der Link zeigt auf den persistenten Server und muss
   *    dessen festen Token aus .review-token benutzen, sonst weist der
   *    Freigabe-Server die Anfrage ab. */
  process.stdout.write("\n=== 3/3 Freigabe-Link ===\n");
  const host = freigabeHost(opts);
  let token;
  let server = null;
  let fertig;
  if (opts.keinServer) {
    token = reviewTokenDatei();
    if (!token) {
      process.stdout.write("Hinweis: kein REVIEW_TOKEN/.review-token gefunden — der Link nutzt den Seed-Token.\n");
      token = "woche-" + seed;
    }
    fertig = Promise.resolve(true);
    process.stdout.write("  Modus         : persistent (eigener Server laeuft per launchd)\n");
    process.stdout.write("  Host          : " + host + "\n");
  } else {
    token = "woche-" + seed;
    server = childProcess.spawn(process.execPath, [
      path.join(PIPELINE, "review-server.js"), "--port", String(opts.port), "--token", token
    ], { cwd: REPO, stdio: ["ignore", "pipe", "inherit"] });
    fertig = warteAufServer(opts.port);
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
  }

  fertig.then(function (bereit) {
    const link = freigabeLink(opts.port, token, host);
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

    /* Im Normalfall haelt der hier gestartete Server den Prozess offen; erst
     * unref() laesst ihn enden, sobald die Mail raus ist. Im --kein-server-
     * Modus gibt es keinen eigenen Server — dann nichts zu unrefen. */
    function serverFreigeben() { if (server) server.unref(); }

    if (!opts.mail) {
      process.stdout.write("\n--keine-mail: Mail bewusst übersprungen.\n");
      serverFreigeben();
      return;
    }

    const clipPfad = path.join(PIPELINE, "work", "queue", path.basename(path.dirname(neuester || "x")), "clip.mp4");
    const zeitraum = opts.daily
      ? isoDate(jetzt)
      : (jetzt.getUTCFullYear() + "-W" + String(woche).padStart(2, "0"));
    const text = [
      "Hallo Andy,",
      "",
      opts.daily
        ? "Der Clip von heute ist gerendert und wartet auf Freigabe."
        : "Die Videos dieser Woche sind gerendert und warten auf Freigabe.",
      "",
      "  Zeitraum     : " + zeitraum,
      "  Hook         : " + hook,
      "  Clip         : " + clipPfad,
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
      "— Mathemit " + (opts.daily ? "Tageslauf" : "Wochenlauf")
    ].join("\n");

    mailSenden("🎬 Neuer Clip zur Freigabe – " + zeitraum + " (" + hook + ")", text)
      .then(function () {
        serverFreigeben();
      });
  });
}

if (require.main === module) main();

module.exports = {
  isoWeek: isoWeek,
  ROTATION: ROTATION,
  parseArgs: parseArgs,
  isoDate: isoDate,
  tagesHook: tagesHook,
  freigabeHost: freigabeHost,
  freigabeLink: freigabeLink,
  tailscaleDnsName: tailscaleDnsName
};