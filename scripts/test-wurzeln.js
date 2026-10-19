/* Mathemit Test-Harness für genPotenzenWurzeln (Potenzen & Wurzeln).
 * Prüft:
 *  1. Wurzelindex steht VOR dem Wurzelzeichen (⁴√256, nicht √256⁴)
 *  2. Bild-Label passt zu den dargestellten Feldern
 *  3. Mathe stimmt: basis^exp = ergebnis, Antwort = basis
 *  4. Hint ist wurzel-relevant (kein Zehnerpotenz-/Kehrwert-Gerede)
 *  5. SVG ist wohlgeformt
 *
 * Aufruf: node scripts/test-wurzeln.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.potenzenWurzeln;

if (!gen) {
  console.log("FEHLER: GEN.potenzenWurzeln nicht gefunden.");
  process.exit(1);
}

var errors = [], runs = 0, DIFFS = [1, 2, 3], RUNS = 200;
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

    // --- WURZEL-spezifische Prüfungen ---
    if (ex.badge.indexOf("Wurzel") !== -1) {
      // 1. Notation: Wurzelindex VOR dem Zeichen (nicht als Hochzahl danach)
      //    exp=2: "√9" (kein Index), exp>2: " 4.√256" (Index davor)
      var q = ex.question;
      if (q.indexOf("√") === -1)
        fail("KEINE-WURZEL diff=" + diff + " #" + i + ": " + q);
      else {
        // Präfix "Wurzel ziehen: " abziehen, dann nur den Teil um √ betrachten
        var qBody = q.replace(/^Wurzel ziehen:\s*/, "");
        var sqrtPos = qBody.indexOf("√");
        var before = qBody.substring(0, sqrtPos).trim();
        var expMatch = qBody.match(/(\d)\.\s*√/);
        var expFromQ = expMatch ? +expMatch[1] : 2;
        if (expFromQ === 2 && before !== "")
          fail("NOTATION-EXP2 diff=" + diff + " #" + i + ": unerwarteter Text vor √ für exp=2 in '" + q + "'");
        if (expFromQ > 2 && before === "")
          fail("NOTATION-EXPGT2 diff=" + diff + " #" + i + ": kein Index vor √ für exp>2 in '" + q + "'");
        // Keine Hochzahl nach der Zahl: √256⁴ ist falsch
        if (q.match(/√\d+\s*[⁰¹²³⁴⁵⁶⁷⁸⁹]/))
          fail("HOCHZAHNACHWURZEL diff=" + diff + " #" + i + ": √Zahl+Hochzahl in '" + q + "'");
      }

      // 2. Mathe: Finde basis, exp, ergebnis aus der explanation
      // explanation: "4.-fache Wurzel aus 256 = 4, denn 4<sup>4</sup> = 256."
      // oder für exp=2: "2.-fache Wurzel aus 16 = 4, denn 4<sup>2</sup> = 16."
      var mExp = ex.explanation.match(/(\d+)\.\-fache Wurzel aus (\d+) = (\d+)/);
      if (mExp) {
        var eExp = +mExp[1], eErgebnis = +mExp[2], eBasis = +mExp[3];
        if (Math.pow(eBasis, eExp) !== eErgebnis)
          fail("MATHE diff=" + diff + " #" + i + ": " + eBasis + "^" + eExp + " ≠ " + eErgebnis);
        if (ex.answer !== eBasis)
          fail("ANSWER-WURZEL diff=" + diff + " #" + i + ": Antwort sollte " + eBasis + " sein, ist " + ex.answer);
        if (expFromQ !== eExp && eExp !== 2)
          fail("NOTATION-MISMATCH diff=" + diff + " #" + i + ": Frage-Exp=" + expFromQ + " vs Erklärung-Exp=" + eExp);
      } else {
        fail("ERKLÄRUNG-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      }

      // 3. Hint: darf nicht über Zehnerpotenz oder Kehrwort reden
      var h = ex.hint;
      if (h.indexOf("Zehner") !== -1 || h.indexOf("Kehrwert") !== -1 || h.indexOf("Minus im Exponenten") !== -1)
        fail("HINT-WURZEL diff=" + diff + " #" + i + ": unpassender Hint '" + h + "'");

      // 4. SVG-Label: Für exp>2 darf "Einheitsquadrate" nicht mit ergebnis behauptet werden,
      //    denn das Bild zeigt nur Lagen à basis×basis, nicht ergebnis Felder.
      var svgStr = String(ex.svg);
      if (mExp && +mExp[1] > 2) {
        if (svgStr.indexOf("Einheitsquadrate") !== -1)
          fail("SVG-LABEL diff=" + diff + " #" + i + ": 'Einheitsquadrate' für exp>2 ist irreführend");
      }
    }
  }
});

console.log("potenzenWurzeln: " + DIFFS.length + " Stufen × " + RUNS + " Runs = " + runs + " Fälle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 40).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("WURZELN_OK");