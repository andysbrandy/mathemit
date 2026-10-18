/* Mathemit Test-Harness für teilbarkeit (P1.16, H1.I1).
 * Prüft mathematische Korrektheit aller 4 Aufgabentypen
 * (Division mit Rest, nächste Primzahl, kgV, ggT) über alle Stufen.
 *
 * Aufruf: node scripts/test-teilbarkeit.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.teilbarkeit;

if (!gen) {
  console.log("FEHLER: GEN.teilbarkeit nicht gefunden.");
  process.exit(1);
}

var errors = [], runs = 0, DIFFS = [1, 2, 3], RUNS = 60;
function fail(m) { errors.push(m); }

function istPrim(n) {
  if (n < 2) return false;
  for (var i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
function ggt(x, y) { while (y !== 0) { var t = y; y = x % y; x = t; } return x; }
function kgv(x, y) { return x * y / ggt(x, y); }

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

    // Zahlen-Input
    if (ex.inputType !== "number")
      fail("INPUTTYPE diff=" + diff + " #" + i + ": erwartet 'number', ist '" + ex.inputType + "'");
    if (typeof ex.answer !== "number" || isNaN(ex.answer))
      fail("ANSWER diff=" + diff + " #" + i + ": keine Zahl (" + ex.answer + ")");

    // SVG wohlgeformt
    if (String(ex.svg).indexOf("<svg") === -1 || String(ex.svg).indexOf("</svg>") === -1)
      fail("SVG diff=" + diff + " #" + i + ": nicht wohlgeformt");

    // Erklärung enthält die Antwort
    if (String(ex.explanation).indexOf(String(ex.answer)) === -1)
      fail("ERKLAERUNG diff=" + diff + " #" + i + ": answer nicht in explanation");

    // Typ-spezifische Mathematik anhand des badges (spezifische Sub-Typen zuerst,
    // da alle Badges "Teilbarkeit · …" enthalten)
    if (ex.badge.indexOf("÷") !== -1) {
      // a ÷ b = q Rest r, denn q×b+r = a.
      var m = ex.explanation.match(/^(\d+) ÷ (\d+) = (\d+) Rest (\d+), denn (\d+)×(\d+)\+(\d+) = (\d+)\.$/);
      if (!m) fail("REST-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var a = +m[1], b = +m[2], q = +m[3], r = +m[4];
        if (+m[5] !== q || +m[6] !== b || +m[7] !== r || +m[8] !== a)
          fail("REST-PROBE diff=" + diff + " #" + i + ": Probe inkonsistent");
        if (q !== Math.floor(a / b) || r !== a % b)
          fail("REST-MATHE diff=" + diff + " #" + i + ": " + a + " ÷ " + b + " ≠ " + q + " Rest " + r);
        if (r >= b) fail("REST-GROESSE diff=" + diff + " #" + i + ": Rest " + r + " ≥ Teiler " + b);
        if (ex.answer !== r) fail("REST-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      }
    } else if (ex.badge.indexOf("Primzahl") !== -1) {
      var m2 = ex.explanation.match(/^Die nächste Primzahl nach (\d+) ist (\d+),/);
      if (!m2) fail("PRIM-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var start = +m2[1], p = +m2[2];
        if (!istPrim(p)) fail("PRIM-NICHTPRIM diff=" + diff + " #" + i + ": " + p + " ist keine Primzahl");
        if (p <= start) fail("PRIM-GROESSE diff=" + diff + " #" + i + ": " + p + " ≤ " + start);
        for (var k = start + 1; k < p; k++)
          if (istPrim(k)) { fail("PRIM-NICHTNAECHSTE diff=" + diff + " #" + i + ": " + k + " liegt dazwischen"); break; }
        if (ex.answer !== p) fail("PRIM-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      }
    } else if (ex.badge.indexOf("kgV") !== -1) {
      var m3 = ex.explanation.match(/^kgV\((\d+), (\d+)\) = (\d+),/);
      if (!m3) fail("KGV-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var z1 = +m3[1], z2 = +m3[2], e = +m3[3];
        if (e !== kgv(z1, z2)) fail("KGV-MATHE diff=" + diff + " #" + i + ": kgV(" + z1 + ", " + z2 + ") ≠ " + e);
        if (ex.answer !== e) fail("KGV-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      }
    } else if (ex.badge.indexOf("ggT") !== -1) {
      var m4 = ex.explanation.match(/^ggT\((\d+), (\d+)\) = (\d+),/);
      if (!m4) fail("GGT-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var g1 = +m4[1], g2 = +m4[2], g = +m4[3];
        if (g !== ggt(g1, g2)) fail("GGT-MATHE diff=" + diff + " #" + i + ": ggT(" + g1 + ", " + g2 + ") ≠ " + g);
        if (ex.answer !== g) fail("GGT-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      }
    } else {
      fail("BADGE diff=" + diff + " #" + i + ": unbekannt ('" + ex.badge + "')");
    }
  }
});

console.log("teilbarkeit: " + DIFFS.length + " Stufen × " + RUNS + " Runs = " + runs + " Fälle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("TEILBARKEIT_OK");
