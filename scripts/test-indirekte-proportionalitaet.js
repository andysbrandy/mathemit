/* Mathemit Test-Harness für indirekteProportionalitaet (P1.19, H2.I2).
 * Prüft: Gesamtarbeit w·d konstant, answer = gesamt/wGesucht, ganzzahlig,
 * SVG enthält Personen/Zeit-Vergleich, Erklärung enthält Gesamtarbeits-Rechnung.
 *
 * Aufruf: node scripts/test-indirekte-proportionalitaet.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.indirekteProportionalitaet;

if (!gen) {
  console.log("FEHLER: GEN.indirekteProportionalitaet nicht gefunden.");
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
    if (typeof ex.answer !== "number" || isNaN(ex.answer) || ex.answer % 1 !== 0 || ex.answer <= 0)
      fail("ANSWER diff=" + diff + " #" + i + ": keine positive ganze Zahl (" + ex.answer + ")");

    if (String(ex.svg).indexOf("<svg") === -1 || String(ex.svg).indexOf("</svg>") === -1)
      fail("SVG diff=" + diff + " #" + i + ": nicht wohlgeformt");
    if (String(ex.svg).indexOf("indirekt") === -1)
      fail("SVG-DIDAKTIK diff=" + diff + " #" + i + ": kein Indirekt-Hinweis im Bild");
    if (String(ex.svg).indexOf("Gesamtarbeit") === -1)
      fail("SVG-GESAMT diff=" + diff + " #" + i + ": keine Gesamtarbeit im Bild");

    if (String(ex.explanation).indexOf(String(ex.answer)) === -1)
      fail("ERKLAERUNG diff=" + diff + " #" + i + ": answer nicht in explanation");

    // Gesamtarbeit muss konstant sein: wGegeben·dGegeben = wGesucht·antwort
    var m = ex.explanation.match(/^Gesamtarbeit: (\d+) · (\d+) = (\d+)\. (\d+) .* (\d+) : (\d+) = (\d+) /);
    if (!m) fail("GESAMT-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
    else {
      var wG = +m[1], dG = +m[2], g = +m[3], wS = +m[4];
      if (wG * dG !== g) fail("GESAMT-MATHE diff=" + diff + " #" + i + ": " + wG + "·" + dG + " ≠ " + g);
      if (+m[5] !== g || +m[6] !== wS) fail("GESAMT-PROBE diff=" + diff + " #" + i + ": Inkonsistenz");
      if (g / wS !== +m[7]) fail("GESAMT-TEIL diff=" + diff + " #" + i + ": " + g + ":" + wS);
      if (ex.answer !== +m[7]) fail("GESAMT-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      if (g % wS !== 0) fail("GESAMT-REST diff=" + diff + " #" + i + ": nicht ganzzahlig teilbar");
    }

    // Kindgerecht: Frage nennt beide Gruppen und "gleich schnell"
    if (String(ex.question).indexOf("gleich schnell") === -1)
      fail("FRAGE-FAIR diff=" + diff + " #" + i + ": kein Fairness-Hinweis");
  }
});

console.log("indirekteProportionalitaet: " + DIFFS.length + " Stufen × " + RUNS + " Runs = " + runs + " Fälle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("INDIREKTE_PROPORTIONALITAET_OK");
