/* Mathemit Test-Harness für kongruenzKonstruktionen (H3, ⬜ neu).
 * Prüft mathematische und didaktische Korrektheit aller 3 Aufgabentypen
 * über alle Schwierigkeitsgrade hinweg.
 *
 * Aufruf: node scripts/test-kongruenz-konstruktionen.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.kongruenzKonstruktionen;

if (!gen) {
  console.log("FEHLER: GEN.kongruenzKonstruktionen nicht gefunden.");
  process.exit(1);
}

var errors = [], runs = 0, DIFFS = [1, 2, 3], RUNS = 40;
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

    // Pflichtfelder
    ["question", "hint", "svg", "badge", "badgeColor", "inputType", "answer", "explanation"].forEach(function (f) {
      if (ex[f] === undefined || ex[f] === null || ex[f] === "")
        fail("FELD diff=" + diff + " #" + i + ": " + f + " fehlt");
    });

    // MC-Struktur
    if (!Array.isArray(ex.choices) || ex.choices.length < 2)
      fail("CHOICES diff=" + diff + " #" + i + ": zu wenige Optionen (" + ex.choices.length + ")");
    if (ex.choices.indexOf(ex.answer) === -1)
      fail("ANTWORT diff=" + diff + " #" + i + ": answer '" + ex.answer + "' nicht in choices");
    if (ex.correctIndex !== ex.choices.indexOf(ex.answer))
      fail("CORRECTINDEX diff=" + diff + " #" + i + ": zeigt nicht auf answer");
    if (!duplikatfrei(ex.choices))
      fail("DUPLIKATE diff=" + diff + " #" + i + ": doppelte Optionen in choices");

    // SVG wohlgeformt
    if (String(ex.svg).indexOf("<svg") === -1 || String(ex.svg).indexOf("</svg>") === -1)
      fail("SVG diff=" + diff + " #" + i + ": nicht wohlgeformt");

    // Erklärung enthält das Ergebnis (für MC: den answer-Text)
    if (String(ex.explanation).indexOf(ex.answer) === -1)
      fail("ERKLAERUNG diff=" + diff + " #" + i + ": answer nicht in explanation");

    // Badge muss Kongruenz enthalten
    if (String(ex.badge).indexOf("Kongruenz") === -1)
      fail("BADGE diff=" + diff + " #" + i + ": erwartetes 'Kongruenz' im Badge, ist '" + ex.badge + "'");

    // Typ-spezifische Prüfung anhand des badges
    if (ex.badge.indexOf("Kongruenz prüfen") !== -1) {
      if (ex.inputType !== "mc") fail("TYP0-INPUT diff=" + diff + " #" + i + ": erwartete mc, ist " + ex.inputType);
      if (ex.choices.indexOf("Ja, kongruent") === -1 || ex.choices.indexOf("Nein, nicht kongruent") === -1)
        fail("TYP0-CHOICES diff=" + diff + " #" + i + ": falsche Optionen");
    } else if (ex.badge.indexOf("Ähnlichkeit") !== -1) {
      if (ex.inputType !== "mc") fail("TYP1-INPUT diff=" + diff + " #" + i + ": erwartete mc, ist " + ex.inputType);
      if (ex.choices.indexOf("Ja, ähnlich") === -1 || ex.choices.indexOf("Nein, nicht ähnlich") === -1)
        fail("TYP1-CHOICES diff=" + diff + " #" + i + ": falsche Optionen");
    } else if (ex.badge.indexOf("Kongruenzsatz") !== -1) {
      if (ex.inputType !== "mc") fail("TYP2-INPUT diff=" + diff + " #" + i + ": erwartete mc, ist " + ex.inputType);
      var gueltig = ["SSS", "SWS", "WSW", "keiner / nicht eindeutig"];
      if (gueltig.indexOf(ex.answer) === -1)
        fail("TYP2-ANSWER diff=" + diff + " #" + i + ": '" + ex.answer + "' nicht unter den gueltigen Saetzen");
    }
  }
});

console.log("kongruenzKonstruktionen: " + DIFFS.length + " Stufen x " + RUNS + " Runs = " + runs + " Faelle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("KONGRUENZ_KONSTRUKTIONEN_OK");