// test/runs.js — Aufteilung der Testsuiten nach Bereich + Auswahl nach Aenderung
//
// Warum das ueberhaupt existiert: `npm test` lief immer alles, egal was
// angefasst wurde. Allein render-frames braucht ~143s, run-pipeline ~62s.
// Wer nur eine Farbe in style-base.css aendert, zahlt damit ueber drei
// Minuten Wartezeit fuer Tests, die den Code gar nicht kennen.
//
// Deshalb zwei Dinge:
//   1) BLOECKE gruppieren die Suites nach Themenbereich.
//   2) `node test/runs.js --changed` schaut in git, welche Dateien sich
//      geaendert haben, und startet nur die Bloecke, die diese Dateien
//      ueberhaupt betreffen.
//
// Bereich der Suite steht in der Kopfzeile jeder Testdatei als
//   // @block video
// Die Zuordnung steht damit an der Suite und nicht hier im Runner, damit
// sie beim Anlegen einer neuen Suite nicht vergessen wird — validateBlocks()
// bricht dann mit einer klaren Meldung ab.

const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..", "..");
const TESTDIR = __dirname;

/* Die Bloecke: welche Suite liegt wo drin, welche Dateien sie betreffen und
 * was sie ungefaehr kosten. "files" sind Repo-Pfade; wird eine davon
 * geaendert, laeuft der Block. */
const BLOECKE = {
  app: {
    titel: "App-Logik (Generatoren, MB-API)",
    /* Laedt app-base.js per require() — bricht bei Syntaxfehlern und
     * fehlendem window.MB ab. Einzige Suite, die die Rechenlogik abdeckt.
     *
     * index.html ist hier mit drin, obwohl keine Suite die Datei liest:
     * sie bindet app-base.js/app-active.js per <script> ein. Ein Tippfehler
     * in der Einbindung laesst die komplette App tot aussehen, und das
     * faellt sonst erst beim Oeffnen der Seite auf. */
    suites: ["select-exercises"],
    files: ["app-base.js", "index.html"],
    zeit: "~1.4s",
  },
  frontend: {
    titel: "Frontend-Struktur (Template, Renderer)",
    /* Prueft, dass Preview und Frames das aktive app-active.js NICHT
     * einbinden — Absicht: die Videobuehne soll ohne Garten laufen. */
    suites: ["render-preview", "png-probe"],
    files: ["content-pipeline/render-preview.js", "content-pipeline/png-probe.js", "app-active.js", "style-base.css", "style-active.css"],
    zeit: "~4.8s",
  },
  frames: {
    titel: "Frame-Rendering (langsam!)",
    /* ~143s, teuerste Suite im Repo. Eigener Block: laeuft nur, wenn wirklich
     * an Buehne oder Renderer gedreht wurde.
     *
     * app-base.js steht hier BEWUSST NICHT: render-frames.js bettet die
     * Datei nur per readFileSync als Text in die Buehne ein (Zeile 272) und
     * fuehrt sie nie aus. Geaenderte Rechenlogik faengt der Block "app"
     * in 1.4s ab — hier wuerden wir 143s fuer eine Einbettung zahlen. */
    suites: ["render-frames"],
    files: ["content-pipeline/render-frames.js", "content-pipeline/lib/"],
    zeit: "~143s",
  },
  video: {
    titel: "Video-Assembling & Clip-Pruefung",
    suites: ["assemble-video", "verify-clip"],
    files: ["content-pipeline/assemble-video.js", "content-pipeline/verify-clip.js"],
    zeit: "~16s",
  },
  pipeline: {
    titel: "Orchestrierung & Timeline",
    suites: ["run-pipeline", "timeline", "timeline-hooks"],
    files: ["content-pipeline/run-pipeline.js", "content-pipeline/timeline.js", "content-pipeline/lib/"],
    zeit: "~62s",
  },
  queue: {
    titel: "Queue & Veroeffentlichung",
    suites: ["queue-episode", "pipeline-control"],
    files: ["content-pipeline/queue-episode.js", "content-pipeline/pipeline-control.js"],
    zeit: "~2.5s",
  },
  review: {
    titel: "Review-Server",
    suites: ["review-server"],
    files: ["content-pipeline/review-server.js"],
    zeit: "~4.2s",
  },
};

/* Geaenderte Dateien den Bloecken zuordnen. Verzeichnisse enden auf "/" und
 * matchen per Praefix, damit "content-pipeline/lib/zeit.js" den Block
 * "pipeline" trifft, ohne dass hier jede Datei einzeln steht. */
function blockFuerDatei(datei) {
  const d = datei.split(path.sep).join("/");
  const treffer = new Set();
  for (const [name, b] of Object.entries(BLOECKE)) {
    for (const f of b.files) {
      if (f.endsWith("/")) { if (d.startsWith(f)) treffer.add(name); }
      else if (d === f) { treffer.add(name); }
    }
  }
  return [...treffer];
}

/* Welche Dateien haben sich geaendert? Verglichen wird gegen origin/main,
 * aber AUCH die noch nicht committeten — sonst wuerde man nach
 * "git checkout" plötzlich meinen Lauf auslassen.
 *
 * Wichtig: leeres Ergebnis heisst NICHT "Fehler". Wenn HEAD == origin/main
 * und die Arbeitszone sauber ist, ist schlicht nichts zu testen. Die frueher
 *ere Version wertete das als Fehler und lief stur alle 12 Suiten —
 * das war die Ursache fuer den unnoetigen Volllauf. */
function geaenderteDateien() {
  const sammle = (args, trim = true) => {
    const r = spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
    if (r.status !== 0) return null;
    return r.stdout.split("\n").filter(Boolean).map((s) => (trim ? s.trim() : s));
  };
  const committet = sammle(["diff", "--name-only", "origin/main...HEAD"]);
  /* Porcelain NICHT trimmen: die fuehrende Spalte ist Teil des Formats
   * (" M ROADMAP.md" = 2 Statuszeichen + 1 Leerzeichen + Pfad). Nach einem
   * trim waere es "M ROADMAP.md" und slice(3) fraesse den ersten
   * Buchstaben — daher hier bewusst ungetrimmt und Index 3 beibehalten. */
  const dirty = sammle(["status", "--porcelain"], false);
  if (committet === null) return null; /* kein Origin -> ehrlich: alles */
  const alle = new Set(committet);
  if (dirty) {
    /* Umbenennungen: "R  alt -> neu" — der neue Name zaehlt. */
    const p = (z) => z.slice(3).trim().split(" -> ").pop().trim().replace(/^"|"$/g, "");
    dirty.forEach((z) => { const q = p(z); if (q) alle.add(q); });
  }
  return [...alle];
}

/* Prueft, dass jede Suite existiert und ihren Block selbst deklariert. */
function validateBlocks() {
  const fehler = [];
  for (const [name, b] of Object.entries(BLOECKE)) {
    for (const s of b.suites) {
      const p = path.join(TESTDIR, s + ".test.js");
      if (!fs.existsSync(p)) { fehler.push(`Block "${name}" verweist auf fehlende Suite: ${s}.test.js`); continue; }
      const kopf = fs.readFileSync(p, "utf8").split("\n").slice(0, 12).join("\n");
      const m = kopf.match(/@block\s+([a-z]+)/);
      if (!m) fehler.push(`${s}.test.js hat kein "// @block <name>" in den ersten 12 Zeilen`);
      else if (m[1] !== name) fehler.push(`${s}.test.js sagt @block ${m[1]}, laeuft aber in Block "${name}"`);
    }
  }
  return fehler;
}

function laufe(suites) {
  if (!suites.length) { console.log("Keine Suite ausgewählt."); return; }
  console.log("\nStarte " + suites.length + " Suite(n)…\n");
  const t0 = Date.now();
  for (const s of suites) {
    const r = spawnSync(process.execPath, [path.join(TESTDIR, s + ".test.js")], { stdio: "inherit" });
    if (r.status !== 0) { console.error("\nFEHLGESCHLAGEN: " + s); process.exit(r.status || 1); }
  }
  console.log(`\nFertig in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function main() {
  const argumente = process.argv.slice(2);
  const fehler = validateBlocks();
  if (fehler.length) { console.error("Block-Zuordnung kaputt:\n  " + fehler.join("\n  ")); process.exit(1); }

  if (argumente.includes("--bloecke")) {
    console.log("Testbloecke (node test/runs.js <name>):\n");
    for (const [name, b] of Object.entries(BLOECKE)) {
      console.log(`  ${name.padEnd(9)} ${b.zeit.padStart(7)}  ${b.titel}`);
      console.log(`  ${" ".repeat(9)} ${" ".repeat(7)}  -> ${b.suites.join(", ")}\n`);
    }
    return;
  }

  /* Aufruf mit Blocknamen: genau diese Suites. */
  const gewaehlt = argumente.filter((a) => BLOECKE[a]);
  if (gewaehlt.length) {
    const namen = new Set();
    gewaehlt.forEach((a) => BLOECKE[a].suites.forEach((s) => namen.add(s)));
    console.log("Block: " + gewaehlt.join(", "));
    laufe([...namen]);
    return;
  }

  const alles = Object.values(BLOECKE).flatMap((b) => b.suites);
  if (!argumente.includes("--changed")) { laufe(alles); return; }

  const dateien = geaenderteDateien();
  if (!dateien) {
    console.log("Kein Vergleich zu origin/main möglich (kein Origin?) — teste alles.\n");
    laufe(alles);
    return;
  }
  if (!dateien.length) {
    console.log("Nichts geändert (HEAD == origin/main, Arbeitszone sauber) — kein Test nötig.");
    return;
  }
  console.log("Geänderte Dateien gegenüber origin/main + Arbeitszone:");
  dateien.forEach((d) => console.log("  " + d));
  const betroffen = new Set();
  dateien.forEach((d) => blockFuerDatei(d).forEach((b) => betroffen.add(b)));
  if (!betroffen.size) {
    console.log("\nKeine davon berührt einen Testblock — nichts zu tun.");
    console.log("(Doku, VERSION, Bilder oder ROADMAP?)");
    return;
  }
  console.log("\nBetroffene Blöcke: " + [...betroffen]
    .map((b) => b + " (" + BLOECKE[b].zeit.trim() + ")")
    .join(", "));
  laufe([...betroffen].flatMap((b) => BLOECKE[b].suites));
}

main();
