/* Mathemit Test-Harness für binomischeFormeln (P1.21, H2.I1).
 * Prüft alle 3 Formeln über alle Stufen: mathematische Korrektheit
 * (Plus/Minus/Plus-Minus), Quadrat-Modell im SVG, MC-Struktur.
 *
 * Aufruf: node scripts/test-binomische-formeln.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.binomischeFormeln;

if (!gen) {
  console.log("FEHLER: GEN.binomischeFormeln nicht gefunden.");
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
    if (String(ex.svg).indexOf("Quadrat") === -1 && String(ex.svg).indexOf("x²") === -1)
      fail("SVG-MODELL diff=" + diff + " #" + i + ": kein Quadrat-Modell");

    if (String(ex.explanation).indexOf(ex.answer) === -1)
      fail("ERKLAERUNG diff=" + diff + " #" + i + ": answer nicht in explanation");

    if (ex.badge.indexOf("Plus-Formel") !== -1) {
      // (x + b)² = x² + 2bx + b²
      var m = ex.explanation.match(/^\(x \+ (\d+)\)² = x² \+ 2·\d+·x \+ \d+² = (x² \+ (\d+)x \+ (\d+))\.$/);
      if (!m) fail("PLUS-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var b = +m[1], ax = +m[3], c = +m[4];
        if (ax !== 2 * b) fail("PLUS-MITTE diff=" + diff + " #" + i + ": 2ab falsch");
        if (c !== b * b) fail("PLUS-QUAD diff=" + diff + " #" + i + ": b² falsch");
        if (ex.answer !== m[2]) fail("PLUS-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      }
    } else if (ex.badge.indexOf("Minus") !== -1 && ex.badge.indexOf("Plus-Minus") === -1) {
      var m2 = ex.explanation.match(/^\(x − (\d+)\)² = x² − 2·\d+·x \+ \d+² = (x² − (\d+)x \+ (\d+))\.$/);
      if (!m2) fail("MINUS-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var b2 = +m2[1], ax2 = +m2[3], c2 = +m2[4];
        if (ax2 !== 2 * b2) fail("MINUS-MITTE diff=" + diff + " #" + i + ": 2ab falsch");
        if (c2 !== b2 * b2) fail("MINUS-QUAD diff=" + diff + " #" + i + ": b² falsch");
        if (ex.answer !== m2[2]) fail("MINUS-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      }
    } else if (ex.badge.indexOf("Plus-Minus") !== -1) {
      var m3 = ex.explanation.match(/^\(x \+ (\d+)\)\(x − \d+\) = x² \+ \d+x − \d+x − \d+² = (x² − (\d+))\.$/);
      if (!m3) fail("PM-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var b3 = +m3[1], c3 = +m3[3];
        if (c3 !== b3 * b3) fail("PM-QUAD diff=" + diff + " #" + i + ": b² falsch");
        if (ex.answer !== m3[2]) fail("PM-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      }
    } else {
      fail("BADGE diff=" + diff + " #" + i + ": unbekannt ('" + ex.badge + "')");
    }
  }
});

console.log("binomischeFormeln: " + DIFFS.length + " Stufen × " + RUNS + " Runs = " + runs + " Fälle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("BINOMISCHE_FORMELN_OK");
