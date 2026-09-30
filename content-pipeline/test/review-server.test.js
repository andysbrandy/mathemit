const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const PIPELINE = path.resolve(__dirname, "..");
const SCRIPT = path.join(PIPELINE, "review-server.js");
const review = require("../review-server");
const queue = require("../queue-episode");

const TOKEN = "test-token-123";

/* Baut eine Queue mit einer vollstaendigen und einer lueckenhaften Episode. */
function makeQueue(dir) {
  fs.mkdirSync(path.join(dir, "voll"), { recursive: true });
  fs.writeFileSync(path.join(dir, "voll", "clip.mp4"), "MP4-NUTZLAST");
  fs.writeFileSync(path.join(dir, "voll", "episode.json"), JSON.stringify({
    schemaVersion: 1, slug: "voll", status: "bereit", releasedAt: null, releasedBy: null,
    caption: "Testcaption", hashtags: ["#a", "#b"],
    source: { seed: "s1", exerciseCount: 1, exerciseIndex: 0, shownPrompt: "Wie viel ist das?" },
    technical: { durationSeconds: 16, frameCount: 480, fps: 30, stage: { width: 1080, height: 1920 },
      codecs: { video: "h264", pixFmt: "yuv420p", audio: false }, verified: true },
    segments: [{ id: "hook", seconds: 3 }, { id: "solution", seconds: 4 }],
    artifacts: { video: "clip.mp4", manifest: "episode.json" }, gaps: []
  }));

  fs.mkdirSync(path.join(dir, "kaputt"), { recursive: true });
  fs.writeFileSync(path.join(dir, "kaputt", "episode.json"), JSON.stringify({
    schemaVersion: 1, slug: "kaputt", status: "unvollstaendig", releasedAt: null, releasedBy: null,
    caption: "x", hashtags: [], source: { seed: "s2", exerciseCount: 1 },
    technical: { durationSeconds: 16, frameCount: 480, stage: { width: 1080, height: 1920 } },
    artifacts: { video: "clip.mp4", manifest: "episode.json" }, gaps: ["MP4 fehlt"]
  }));
  return dir;
}

/* Startet den Server auf einem freien Port und liefert eine Anfrage-Hilfe. */
function withServer(dir, body, withStudio) {
  return new Promise(function (resolve, reject) {
    /*
     * withStudio schaltet die Laufsteuerung frei. Ohne sie liefert "/" die
     * Freigabeliste — das ist gewollt (--list-only) und wird getestet.
     */
    const opts = { queue: dir, port: 0, host: "127.0.0.1", token: TOKEN, open: !!withStudio };
    const server = review.createServer(opts);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", function () {
      const port = server.address().port;
      const request = function (method, target, form) {
        return new Promise(function (done, failRequest) {
          const payload = form ? new URLSearchParams(form).toString() : null;
          const req = http.request({
            host: "127.0.0.1", port: port, method: method, path: target,
            headers: payload ? {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(payload)
            } : {}
          }, function (res) {
            let data = "";
            res.on("data", function (chunk) { data += chunk; });
            res.on("end", function () { done({ status: res.statusCode, body: data }); });
          });
          req.on("error", failRequest);
          if (payload) req.write(payload);
          req.end();
        });
      };
      body(request).then(function (result) {
        server.close(function () { resolve(result); });
      }, function (error) {
        server.close(function () { reject(error); });
      });
    });
  });
}

/* 1 — Optionen werden geprueft, der Token wird erzeugt, wenn keiner kommt. */
function testArgumentHandling() {
  const parsed = review.parseArgs([]);
  assert.equal(parsed.port, 8787, "Vorgabe-Port fehlt");
  assert.ok(parsed.token && parsed.token.length >= 12, "es wird kein Token erzeugt");
  assert.ok(path.isAbsolute(parsed.queue), "Queue wird nicht absolut aufgeloest");

  assert.equal(review.parseArgs(["--token", "abc"]).token, "abc");
  assert.equal(review.parseArgs(["--port", "9000"]).port, 9000);

  [80, 70000, "abc", 0].forEach(function (port) {
    assert.throws(function () { review.parseArgs(["--port", String(port)]); }, /Port/,
      "Port " + port + " wurde akzeptiert");
  });
}


/* 2 — Ohne Token wird nichts gezeigt und nichts geaendert. */
function testTokenRequired() {
  const dir = makeQueue(fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-rev-tok-")));
  return withServer(dir, async function (request) {
    const ohne = await request("GET", "/");
    assert.equal(ohne.status, 401, "die Startseite ist ohne Token zugaenglich");
    assert.match(ohne.body, /Token/, "die Meldung nennt den Token nicht");

    const detail = await request("GET", "/e/voll");
    assert.equal(detail.status, 401, "die Episodenseite ist ohne Token zugaenglich");

    const video = await request("GET", "/v/voll");
    assert.equal(video.status, 403, "das MP4 ist ohne Token abrufbar");

    const falsch = await request("GET", "/?token=falsch");
    assert.equal(falsch.status, 401, "ein falscher Token wird akzeptiert");

    /* Und eine Freigabe ohne Token darf nichts bewirken. */
    const post = await request("POST", "/release", { token: "falsch", slug: "voll" });
    assert.equal(post.status, 403, "eine Freigabe mit falschem Token wird angenommen");
    const record = JSON.parse(fs.readFileSync(path.join(dir, "voll", "episode.json"), "utf8"));
    assert.equal(record.status, "bereit", "die Episode wurde ohne Token freigegeben");
  }).then(function () { fs.rmSync(dir, { recursive: true, force: true }); });
}

/* 3 — Pfade zeigen nicht aus der Queue heraus. */
function testPathSafety() {
  assert.equal(review.validSlug("p7-3-5-i0"), true, "ein normaler Slug wird abgewiesen");
  ["../../etc/passwd", "..", "a/b", "", "x".repeat(65), "a\\b"].forEach(function (slug) {
    assert.equal(review.validSlug(slug), false, "Slug " + JSON.stringify(slug) + " ist zulaessig");
  });
  const dir = makeQueue(fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-rev-pfad-")));
  assert.throws(function () { review.episodeDir({ queue: dir }, "../aussen"); }, /Ungueltiger Name/);
  assert.equal(review.episodeDir({ queue: dir }, "voll"), path.join(dir, "voll"));
  fs.rmSync(dir, { recursive: true, force: true });
  return Promise.resolve();
}

/* 4 — Die Seite zeigt Episode, Caption, Hashtags und Technik. */
function testRendersEpisode() {
  const dir = makeQueue(fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-rev-ans-")));
  return withServer(dir, async function (request) {
    const index = await request("GET", "/?token=" + TOKEN);
    assert.equal(index.status, 200);
    assert.match(index.body, /voll/, "die Episode fehlt in der Liste");
    assert.match(index.body, /nichts davon wird veroeffentlicht/i,
      "der Hinweis auf manuelles Posten fehlt");
    assert.match(index.body, /das Posten bleibt manuell/i, "der Hinweis auf manuelles Posten fehlt");

    const detail = await request("GET", "/e/voll?token=" + TOKEN);
    assert.equal(detail.status, 200);
    assert.match(detail.body, /Testcaption/, "die Caption fehlt");
    assert.match(detail.body, /#a/, "die Hashtags fehlen");
    /* P7.5 — Die Felder sind benannt statt als Fachbegriff ausgewiesen. */
    assert.match(detail.body, /1080x1920|1080 × 1920/, "die Aufloesung fehlt");
    assert.match(detail.body, /Format/, "die Felder haben keine Bezeichnung");
    assert.match(detail.body, /Dauer/, "die Dauer hat keine Bezeichnung");
    assert.match(detail.body, /Freigeben/, "die Freigabemoeglichkeit fehlt");
    /* P7.5.2 — Die Seite nennt die Aufgabe, die im Clip steht. Ohne diesen
       Beleg blieb nur eine geratene "1." und damit die falsche Caption. */
    assert.match(detail.body, /Wie viel ist das\?/, "die Frage aus dem Clip fehlt auf der Seite");
    /* Von jeder Seite kommt man ueber die Leiste zurueck. */
    assert.match(detail.body, /class="nav"/, "die Navigation fehlt auf der Episodenseite");
    assert.match(detail.body, /href="\/\?token=/, "die Navigation fuehrt nicht zur Werkstatt");

    const video = await request("GET", "/v/voll?token=" + TOKEN);
    assert.equal(video.status, 200);
    assert.equal(video.body, "MP4-NUTZLAST", "das MP4 kam nicht unveraendert an");
  }).then(function () { fs.rmSync(dir, { recursive: true, force: true }); });
}

/* 5 — Eine lueckenhafte Episode laesst sich auch per Link nicht freigeben. */
function testReleaseRules() {
  const dir = makeQueue(fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-rev-frei-")));
  return withServer(dir, async function (request) {
    const page = await request("GET", "/e/kaputt?token=" + TOKEN);
    assert.equal(page.status, 200);
    assert.doesNotMatch(page.body, /<button/, "eine lueckenhafte Episode bietet die Freigabe an");
    assert.match(page.body, /Nicht freigabefaehig/, "der Grund wird nicht genannt");

    /* Und ein erzwungener POST wird abgelehnt. */
    const post = await request("POST", "/release", { token: TOKEN, slug: "kaputt" });
    assert.equal(post.status, 400, "eine lueckenhafte Episode liess sich freigeben");
    const record = JSON.parse(fs.readFileSync(path.join(dir, "kaputt", "episode.json"), "utf8"));
    assert.equal(record.status, "unvollstaendig", "der Status wurde trotzdem veraendert");
    assert.equal(record.releasedAt, null);

    /* Die vollstaendige Episode laesst sich freigeben. */
    const ok = await request("POST", "/release", { token: TOKEN, slug: "voll" });
    assert.equal(ok.status, 200, "die Freigabe schlug fehl: " + ok.body.slice(0, 200));
    const freed = JSON.parse(fs.readFileSync(path.join(dir, "voll", "episode.json"), "utf8"));
    assert.equal(freed.status, "freigegeben");
    assert.ok(freed.releasedAt, "die Freigabezeit fehlt");
    assert.equal(freed.releasedBy, "manuell");
  }).then(function () { fs.rmSync(dir, { recursive: true, force: true }); });
}

/* 6 — HTML wird entschaerft und fremde Slugs abgewiesen. */

/* 7 — P7.5: Von jeder Seite kommt man zurueck zur Werkstatt. */
function testNavigationReturnsHome() {
  const dir = makeQueue(fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-rev-nav-")));
  return withServer(dir, async function (request) {
    /* true = mit Laufsteuerung. Ohne sie waere "/" nur die Freigabeliste. */
    const start = await request("GET", "/?token=" + TOKEN);
    assert.equal(start.status, 200, "die Werkstatt liefert keinen Erfolg");
    assert.match(start.body, /<h1[^>]*>Mathemit — Videowerkstatt</,
      "die Werkstatt rendert nicht");
    assert.match(start.body, /class="nav"/, "die Werkstatt hat keine Leiste");
    assert.match(start.body, />Werkstatt</, "der Eintrag zur Werkstatt fehlt");
    assert.match(start.body, />Freigabeliste</, "der Eintrag zur Freigabeliste fehlt");
    /* Die Formularfelder muessen benannt sein, nicht nur technisch heissen. */
    ["Seed", "Hook", "Aufgaben in der Episode", "Davon im Clip zeigen"].forEach(function (label) {
      assert.ok(start.body.indexOf(label) !== -1, "die Felderbezeichnung fehlt: " + label);
    });
    /*
     * P7.5.2 — Oben sind bis zu fuenf Aufgaben waehlbar, also muss auch
     * jede davon als "Davon im Clip zeigen" auswaehlbar sein. Vorher endete
     * die Liste bei der dritten.
     */
    [0, 1, 2, 3, 4].forEach(function (value) {
      assert.ok(start.body.indexOf("<option value=\"" + value + "\">die " + (value + 1) + ".</option>") !== -1,
        "die Auswahl der Aufgabe " + (value + 1) + " fehlt im Formular");
    });
    /*
     * P7.5 — Auf der Startseite gibt es keinen Player mehr. Der Clip wird
     * ueber die Warteschlange angesehen. Diese Pruefungen halten fest, dass
     * die Vorschau dort auch nicht zurueckkehrt.
     */
    assert.doesNotMatch(start.body, /id="preview"/,
      "die Vorschau ist auf der Startseite wieder da");
    assert.doesNotMatch(start.body, /<video/,
      "die Startseite liefert wieder einen Player aus");
    assert.doesNotMatch(start.body, /previewRest|previewLink|SEGNAMEN/,
      "Reste der Vorschau sind noch im Skript");
    assert.doesNotMatch(start.body, /function preview\(/,
      "die Vorschau zeichnet sich noch selbst");
    assert.doesNotMatch(start.body, /col2|col3/,
      "die Spalten der Vorschau sind noch da");
    /* Der Weg zum Clip muss trotzdem offen bleiben: ueber die Warteschlange. */
    assert.match(start.body, /\/p\//,
      "von der Startseite fuehrt kein Weg mehr zum Clip");

    const list = await request("GET", "/freigabe?token=" + TOKEN);
    assert.match(list.body, /href="\/\?token=/, "von der Freigabeliste geht es nicht zurueck");
    assert.match(list.body, /href="\/freigabe\?token=/, "der Listeneintrag markiert sich nicht selbst");

    const episode = await request("GET", "/e/voll?token=" + TOKEN);
    assert.match(episode.body, /href="\/\?token=/,
      "von der Episodenseite geht es nicht zurueck");

    /* Und die grosse Vorschau ist von beiden Seiten erreichbar. */
    const preview = await request("GET", "/p/voll?token=" + TOKEN);
    assert.equal(preview.status, 200, "die grosse Vorschau fehlt");
    assert.match(preview.body, /class="nav"/, "die Vorschau hat keine Leiste");
    assert.match(preview.body, /href="\/e\/voll\?token=/, "von der Vorschau geht es nicht zur Freigabe");
    assert.match(preview.body, /Testcaption/, "die Vorschau zeigt die Caption nicht");
  }, true).then(function () { fs.rmSync(dir, { recursive: true, force: true }); });
}

/* 8 — Die Vorschau einer lueckenhaften Episode sagt das auch. */
function testPreviewWithoutVideo() {
  const dir = makeQueue(fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-rev-pv-")));
  return withServer(dir, async function (request) {
    const preview = await request("GET", "/p/kaputt?token=" + TOKEN);
    assert.equal(preview.status, 200, "die Vorschau bricht statt zu erklaeren ab");
    assert.match(preview.body, /kein MP4/, "es wird nicht gesagt, dass der Clip fehlt");
    assert.doesNotMatch(preview.body, /<video/, "es wird ein Player ohne Datei gezeigt");
  }).then(function () { fs.rmSync(dir, { recursive: true, force: true }); });
}

function testEscapesHtml() {
  assert.equal(review.escapeHtml("<script>"), "&lt;script&gt;");
  assert.equal(review.escapeHtml("a & b"), "a &amp; b");
  assert.equal(review.escapeHtml("\"x\""), "&quot;x&quot;");
  assert.equal(review.escapeHtml("'x'"), "&#39;x&#39;");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mathemit-rev-xss-"));
  return withServer(dir, async function (request) {
    const res = await request("GET", "/e/" + encodeURIComponent("böse/../../x") + "?token=" + TOKEN);
    assert.notEqual(res.status, 200, "ein fremder Pfad wurde ungeprueft akzeptiert");
  }).then(function () { fs.rmSync(dir, { recursive: true, force: true }); });
}

const tests = [
  testArgumentHandling,
  testTokenRequired,
  testPathSafety,
  testRendersEpisode,
  testReleaseRules,
  testEscapesHtml,
  testNavigationReturnsHome,
  testPreviewWithoutVideo
];

(async function () {
  for (const test of tests) {
    try {
      await test();
      process.stdout.write("PASS " + test.name + "\n");
    } catch (error) {
      process.stdout.write("FAIL " + test.name + ": " + error.message + "\n");
      process.exit(1);
    }
  }
  process.stdout.write("REVIEW_SERVER_OK (" + tests.length + " Tests)\n");
})();
