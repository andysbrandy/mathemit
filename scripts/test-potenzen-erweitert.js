/* Mathemit Test-Harness für potenzenErweitert (P1.18, H1/H2).
 * Prüft alle 3 Typen: Zehnerpotenz (1 + n Nullen), Gleitkomma
 * (Komma-Schiebung), negativer Exponent (Kehrwert, beide Antwortarten).
 *
 * Aufruf: node scripts/test-potenzen-erweitert.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.potenzenErweitert;

if (!gen) {
  console.log("FEHLER: GEN.potenzenErweitert nicht gefunden.");
  process.exit(1);
}

var errors = [], runs = 0, DIFFS = [1, 2, 3], RUNS = 60;
function fail(m) { errors.push(m); }

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

    if (ex.inputType !== "number")
      fail("INPUTTYPE diff=" + diff + " #" + i + ": erwartet 'number', ist '" + ex.inputType + "'");
    if (typeof ex.answer !== "number" || isNaN(ex.answer) || ex.answer <= 0)
      fail("ANSWER diff=" + diff + " #" + i + ": keine positive Zahl (" + ex.answer + ")");

    if (String(ex.svg).indexOf("<svg") === -1 || String(ex.svg).indexOf("</svg>") === -1)
      fail("SVG diff=" + diff + " #" + i + ": nicht wohlgeformt");

    if (ex.badge.indexOf("Zehnerpotenz") !== -1) {
      var m = ex.question.match(/10 hoch (\d+) = \?/);
      if (!m) fail("ZEHN-FRAGE diff=" + diff + " #" + i + ": " + ex.question);
      else {
        var n = +m[1];
        if (ex.answer !== Math.pow(10, n))
          fail("ZEHN-MATHE diff=" + diff + " #" + i + ": 10^" + n + " ≠ " + ex.answer);
        if (String(ex.svg).indexOf("Nullen") === -1)
          fail("ZEHN-SVG diff=" + diff + " #" + i + ": kein Nullen-Hinweis im Bild");
      }
    } else if (ex.badge.indexOf("Gleitkomma") !== -1) {
      var m2 = ex.question.match(/([\d,]+) · 10 hoch (\d+) = \?/);
      if (!m2) fail("GLEIT-FRAGE diff=" + diff + " #" + i + ": " + ex.question);
      else {
        var mant = parseFloat(m2[1].replace(",", ".")), ne = +m2[2];
        var erwartet = Math.round(mant * Math.pow(10, ne) * 100) / 100;
        if (Math.abs(ex.answer - erwartet) > 0.001)
          fail("GLEIT-MATHE diff=" + diff + " #" + i + ": " + mant + "·10^" + ne + " ≠ " + ex.answer);
        if (String(ex.svg).indexOf("Komma") === -1)
          fail("GLEIT-SVG diff=" + diff + " #" + i + ": kein Komma-Hinweis im Bild");
      }
    } else if (ex.badge.indexOf("Negativer Exponent") !== -1) {
      var m3 = ex.question.match(/(\d+) hoch −(\d+)/);
      if (!m3) fail("NEG-FRAGE diff=" + diff + " #" + i + ": " + ex.question);
      else {
        var bb = +m3[1], nn = +m3[2];
        var nenner = Math.pow(bb, nn);
        var okDez = Math.abs(ex.answer - Math.round((1/nenner)*1000)/1000) < 0.0001;
        var okNen = ex.answer === nenner;
        if (!okDez && !okNen)
          fail("NEG-MATHE diff=" + diff + " #" + i + ": " + bb + "^-" + nn + " → " + ex.answer);
        if (String(ex.svg).indexOf("Kehrwert") === -1)
          fail("NEG-SVG diff=" + diff + " #" + i + ": kein Kehrwert-Hinweis im Bild");
      }
    } else {
      fail("BADGE diff=" + diff + " #" + i + ": unbekannt ('" + ex.badge + "')");
    }
  }
});

console.log("potenzenErweitert: " + DIFFS.length + " Stufen × " + RUNS + " Runs = " + runs + " Fälle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("POTENZEN_ERWEITERT_OK");
