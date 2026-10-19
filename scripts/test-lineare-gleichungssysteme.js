/* Mathemit Test-Harness für lineareGleichungssysteme (P1.22, H2.I1).
 * Prüft beide Verfahren: Lösung erfüllt BEIDE Gleichungen (Probe),
 * x/y positiv ganzzahlig, Schritt-Anleitung + Probe im SVG, MC-Struktur.
 *
 * Aufruf: node scripts/test-lineare-gleichungssysteme.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.lineareGleichungssysteme;

if (!gen) {
  console.log("FEHLER: GEN.lineareGleichungssysteme nicht gefunden.");
  process.exit(1);
}

var errors = [], runs = 0, DIFFS = [1, 2, 3], RUNS = 60;
function fail(m) { errors.push(m); }

function duplikatfrei(arr) {
  var seen = {};
  for (var i = 0; i < arr.length; i++) {
    if (seen[arr[i]]) return false;
    seen[arr[i]] = true;
  }
  return true;
}

// "x = 3, y = 5" -> {x:3, y:5}
function parsePaar(s) {
  var m = String(s).match(/^x = (\d+), y = (\d+)$/);
  return m ? {x:+m[1], y:+m[2]} : null;
}

DIFFS.forEach(function(diff) {
  for (var i = 0; i < RUNS; i++) {
    runs++;
    var ex;
    try { ex = gen(diff); }
    catch (e) { fail("THROW diff=" + diff + " #" + i + ": " + e.message); continue; }

    ["question", "hint", "svg", "badge", "badgeColor", "inputType", "answer", "explanation"].forEach(function (f) {
      if (ex[f] === undefined || ex[f] === null || ex[f] === "")
        fail("FELD diff=" + diff + " #" + i + ": " + f + " fehlt");
    });

    if (!Array.isArray(ex.choices) || ex.choices.length < 2)
      fail("CHOICES diff=" + diff + " #" + i + ": zu wenige Optionen");
    if (ex.choices.indexOf(ex.answer) === -1)
      fail("ANTWORT diff=" + diff + " #" + i + ": answer nicht in choices");
    if (ex.correctIndex !== ex.choices.indexOf(ex.answer))
      fail("CORRECTINDEX diff=" + diff + " #" + i + ": zeigt nicht auf answer");
    if (!duplikatfrei(ex.choices))
      fail("DUPLIKATE diff=" + diff + " #" + i + ": doppelte Optionen");

    if (String(ex.svg).indexOf("<svg") === -1 || String(ex.svg).indexOf("</svg>") === -1)
      fail("SVG diff=" + diff + " #" + i + ": nicht wohlgeformt");
    if (String(ex.svg).indexOf("Schritt") === -1)
      fail("SVG-SCHRITT diff=" + diff + " #" + i + ": keine Schritt-Anleitung im Bild");
    if (String(ex.svg).indexOf("Probe") === -1)
      fail("SVG-PROBE diff=" + diff + " #" + i + ": kein Probe-Hinweis im Bild");

    var paar = parsePaar(ex.answer);
    if (!paar) fail("PAAR-FORMAT diff=" + diff + " #" + i + ": " + ex.answer);
    else {
      if (paar.x < 1 || paar.y < 1)
        fail("PAAR-POSITIV diff=" + diff + " #" + i + ": nicht positiv (" + ex.answer + ")");
    }

    if (ex.badge.indexOf("Einsetzen") !== -1) {
      // y = a1x + c1 und y = a2x + c2 aus Frage lesen, Probe mit (x,y)
      var q = ex.question.match(/y = (\d+)x \+ (\d+) und y = (\d+)x \+ (\d+)\./);
      if (!q) fail("EINSETZ-FRAGE diff=" + diff + " #" + i + ": " + ex.question);
      else if (paar) {
        var a1 = +q[1], c1 = +q[2], a2 = +q[3], c2 = +q[4];
        if (a1 * paar.x + c1 !== paar.y)
          fail("EINSETZ-PROBE1 diff=" + diff + " #" + i + ": Gl1 verletzt");
        if (a2 * paar.x + c2 !== paar.y)
          fail("EINSETZ-PROBE2 diff=" + diff + " #" + i + ": Gl2 verletzt");
      }
    } else if (ex.badge.indexOf("Addieren") !== -1) {
      var q2 = ex.question.match(/(\d+)x \+ (\d+)y = (\d+) und (\d+)x − (\d+)y = (\d+)\./);
      if (!q2) fail("ADDIER-FRAGE diff=" + diff + " #" + i + ": " + ex.question);
      else if (paar) {
        var A1 = +q2[1], B1 = +q2[2], C1 = +q2[3], A2 = +q2[4], B2 = +q2[5], C2 = +q2[6];
        if (A1 * paar.x + B1 * paar.y !== C1)
          fail("ADDIER-PROBE1 diff=" + diff + " #" + i + ": Gl1 verletzt");
        if (A2 * paar.x - B2 * paar.y !== C2)
          fail("ADDIER-PROBE2 diff=" + diff + " #" + i + ": Gl2 verletzt");
        if (B1 !== B2)
          fail("ADDIER-HEBUNG diff=" + diff + " #" + i + ": y-Koeffizienten heben sich nicht auf");
      }
    } else {
      fail("BADGE diff=" + diff + " #" + i + ": unbekannt ('" + ex.badge + "')");
    }
  }
});

console.log("lineareGleichungssysteme: " + DIFFS.length + " Stufen × " + RUNS + " Runs = " + runs + " Fälle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("LINEARE_GLEICHUNGSSYSTEME_OK");
