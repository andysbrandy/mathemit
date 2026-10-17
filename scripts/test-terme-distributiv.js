/* Mathemit Test-Harness für termeDistributiv (P1.17, H2.I1).
 * Prüft mathematische und didaktische Korrektheit aller 3 Aufgabentypen
 * über alle Schwierigkeitsgrade hinweg.
 *
 * Aufruf: node scripts/test-terme-distributiv.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.termeDistributiv;

if (!gen) {
  console.log("FEHLER: GEN.termeDistributiv nicht gefunden.");
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

    // Erklärung enthält das Ergebnis
    if (String(ex.explanation).indexOf(ex.answer) === -1)
      fail("ERKLAERUNG diff=" + diff + " #" + i + ": answer nicht in explanation");

    // Typ-spezifische Prüfung anhand des badges
    if (ex.badge.indexOf("Ausklammern") !== -1) {
      // a·x ± a·b = a·(x ± b)  (Punkt am Ende möglich)
      var m = ex.explanation.match(/^(\d+)x ([−+-]) (\d+) = (\d+)·\(x ([−+-]) (\d+)\)/);
      if (!m) fail("AUSKLAMMERN-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var a = +m[1], op1 = m[2], ab = +m[3], a2 = +m[4], op2 = m[5], b = +m[6];
        if (a !== a2) fail("AUSKLAMMERN-A diff=" + diff + " #" + i + ": Faktor inkonsistent");
        if (op1 !== op2) fail("AUSKLAMMERN-OP diff=" + diff + " #" + i + ": Vorzeichen inkonsistent");
        if (ab !== a * b) fail("AUSKLAMMERN-AB diff=" + diff + " #" + i + ": " + ab + " ≠ " + a + "*" + b);
        if (ex.answer !== a2 + "·(x " + op2 + " " + b + ")")
          fail("AUSKLAMMERN-ANSWER diff=" + diff + " #" + i + ": " + ex.answer);
      }
      // Flächenmodell im SVG: zwei Teilrechtecke mit unterschiedlicher Breite
      if (String(ex.svg).indexOf("Flächenmodell") === -1)
        fail("FLÄCHENMODELL diff=" + diff + " #" + i + ": fehlt im SVG");
    } else if (ex.badge.indexOf("Distributivgesetz") !== -1) {
      // a·(x ± b) = ax ± ab  oder  a·(cx ± b) = ac·x ± ab
      if (String(ex.explanation).indexOf("= ") === -1)
        fail("DISTRIBUTIV-ERKLAERUNG diff=" + diff + " #" + i + ": keine Umformung");
    } else if (ex.badge.indexOf("Gleichartige zusammenfassen") !== -1) {
      // ax ± bx = koeff x = koeff x  (Punkt am Ende möglich)
      var m2 = ex.explanation.match(/^(-?\d+)x ([−+-]) (-?\d+)x = (-?\d+)x = (-?\d+)x/);
      if (!m2) fail("GLEICHETERME-FORMAT diff=" + diff + " #" + i + ": " + ex.explanation);
      else {
        var a3 = +m2[1], op3 = m2[2], b3 = +m2[3], koeff = +m2[4], ergebnis = +m2[5];
        var erwartet = op3 === "−" ? (a3 - b3) : (a3 + b3);
        if (koeff !== erwartet) fail("GLEICHETERME-KOEFF diff=" + diff + " #" + i + ": " + koeff + " ≠ " + erwartet);
        if (ergebnis !== koeff) fail("GLEICHETERME-ERGEBNIS diff=" + diff + " #" + i + ": " + ergebnis);
      }
    }
  }
});

console.log("termeDistributiv: " + DIFFS.length + " Stufen × " + RUNS + " Runs = " + runs + " Fälle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("TERME_DISTRIBUTIV_OK");
