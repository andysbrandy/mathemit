/* Mathemit Test-Harness für grundkonstruktionen (P1.23, H3).
 * Prüft mathematische und didaktische Korrektheit aller 3 Aufgabentypen
 * (Streckensymmetrale, Winkelsymmetrale, Mittelsenkrechte) über alle
 * Schwierigkeitsgrade hinweg.
 *
 * Aufruf: node scripts/test-grundkonstruktionen.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.grundkonstruktionen;

if (!gen) {
  console.log("FEHLER: GEN.grundkonstruktionen nicht gefunden.");
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

/* Extrahiert die Streckenlaenge aus einem Text (fuer "AB = 12 cm"-Pruefungen) */
function zahlIn(text){
  var m = String(text).match(/(\d+)\s*cm/);
  return m ? parseInt(m[1], 10) : null;
}

var typenGesehen = {};

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

    // SVG wohlgeformt + Punkte/Linien vorhanden
    if (String(ex.svg).indexOf("<svg") === -1 || String(ex.svg).indexOf("</svg>") === -1)
      fail("SVG diff=" + diff + " #" + i + ": nicht wohlgeformt");
    if (String(ex.svg).indexOf("<line") === -1)
      fail("SVG diff=" + diff + " #" + i + ": keine Linie gezeichnet");
    if (String(ex.svg).indexOf("<circle") === -1)
      fail("SVG diff=" + diff + " #" + i + ": kein Punkt gezeichnet");

    // Eingabetyp
    if (ex.inputType !== "mc" && ex.inputType !== "number")
      fail("INPUTTYPE diff=" + diff + " #" + i + ": unerwartet " + ex.inputType);

    if (ex.inputType === "mc") {
      if (!Array.isArray(ex.choices) || ex.choices.length < 2)
        fail("CHOICES diff=" + diff + " #" + i + ": zu wenige Optionen");
      if (ex.choices.indexOf(ex.answer) === -1)
        fail("ANTWORT diff=" + diff + " #" + i + ": answer '" + ex.answer + "' nicht in choices");
      if (ex.correctIndex !== ex.choices.indexOf(ex.answer))
        fail("CORRECTINDEX diff=" + diff + " #" + i + ": zeigt nicht auf answer");
      if (!duplikatfrei(ex.choices))
        fail("DUPLIKATE diff=" + diff + " #" + i + ": doppelte Optionen");
    } else {
      if (typeof ex.answer !== "number" || !isFinite(ex.answer))
        fail("ANTWORT diff=" + diff + " #" + i + ": keine Zahl als Antwort (" + ex.answer + ")");
      if (!ex.unit)
        fail("UNIT diff=" + diff + " #" + i + ": Einheit fehlt");
    }
    // Didaktik: Loesung muss erklaert werden
    if (ex.inputType === "mc" && String(ex.explanation).indexOf(ex.answer) === -1)
      fail("ERKLAERUNG diff=" + diff + " #" + i + ": answer nicht in explanation");
    if (ex.inputType === "number" && String(ex.explanation).indexOf(String(ex.answer)) === -1)
      fail("ERKLAERUNG diff=" + diff + " #" + i + ": answer '" + ex.answer + "' nicht in explanation");

    // Tipp-System: mind. 1 Tipp
    if (!ex.tips || ex.tips.length < 1)
      fail("TIPP diff=" + diff + " #" + i + ": kein Tipp");

    // Typ-spezifische Pruefung anhand des badges
    if (ex.badge.indexOf("Streckensymmetrale") !== -1) {
      typenGesehen.strecke = true;
      if (ex.inputType !== "mc")
        fail("TYP0-INPUT diff=" + diff + " #" + i + ": erwartete mc, ist " + ex.inputType);
      // Gegeben sind g und P – Q ist die gesuchte Loesung und darf NICHT vorweggenommen sein
      if (String(ex.svg).indexOf(">P<") === -1)
        fail("TYP0-SVG diff=" + diff + " #" + i + ": Punkt P fehlt");
      if (String(ex.svg).indexOf(">Q<") !== -1)
        fail("TYP0-SVG diff=" + diff + " #" + i + ": Q wird vorweggenommen (Loesung verraten)");
      if (String(ex.svg).indexOf(">g<") === -1)
        fail("TYP0-SVG diff=" + diff + " #" + i + ": Gerade g fehlt");
      if (String(ex.svg).indexOf("Schritt 1") === -1)
        fail("TYP0-SVG diff=" + diff + " #" + i + ": Konstruktionsschritte fehlen");
    } else if (ex.badge.indexOf("Winkelsymmetrale") !== -1) {
      typenGesehen.winkel = true;
      if (ex.inputType !== "mc")
        fail("TYP1-INPUT diff=" + diff + " #" + i + ": erwartete mc, ist " + ex.inputType);
      // Gegeben sind S und P – Q ist die gesuchte Loesung
      if (String(ex.svg).indexOf(">S<") === -1 || String(ex.svg).indexOf(">P<") === -1)
        fail("TYP1-SVG diff=" + diff + " #" + i + ": Punkte S oder P fehlen");
      if (String(ex.svg).indexOf(">Q<") !== -1)
        fail("TYP1-SVG diff=" + diff + " #" + i + ": Q wird vorweggenommen (Loesung verraten)");
      if (String(ex.svg).indexOf("°") === -1)
        fail("TYP1-SVG diff=" + diff + " #" + i + ": Winkelgrad fehlt");
    } else if (ex.badge.indexOf("Mittelsenkrechte") !== -1) {
      typenGesehen.mitte = true;
      if (ex.inputType !== "number")
        fail("TYP2-INPUT diff=" + diff + " #" + i + ": erwartete number, ist " + ex.inputType);
      if (ex.unit !== "cm")
        fail("TYP2-UNIT diff=" + diff + " #" + i + ": erwartete cm, ist " + ex.unit);
      var ab = zahlIn(ex.question);
      if (ab === null)
        fail("TYP2-FRAGE diff=" + diff + " #" + i + ": keine Streckenlaenge in der Frage");
      else {
        if (ab % 2 !== 0)
          fail("TYP2-LAENGE diff=" + diff + " #" + i + ": AB=" + ab + " ist ungerade -> Haelfte nicht ganzzahlig");
        if (ex.answer !== ab / 2)
          fail("TYP2-ANTWORT diff=" + diff + " #" + i + ": AB=" + ab + " -> erwartet " + (ab / 2) + ", ist " + ex.answer);
      }
      if (String(ex.svg).indexOf(">A<") === -1 || String(ex.svg).indexOf(">B<") === -1)
        fail("TYP2-SVG diff=" + diff + " #" + i + ": Punkte A oder B fehlen");
    } else {
      fail("BADGE diff=" + diff + " #" + i + ": unbekanntes Badge '" + ex.badge + "'");
    }

    // Curriculum-Key muss gesetzt sein
    if (ex.curriculumKey !== "grundkonstruktionen")
      fail("CURRICULUM diff=" + diff + " #" + i + ": curriculumKey ist '" + ex.curriculumKey + "'");
  }
});
// Alle drei Typen muessen vorgekommen sein
["strecke", "winkel", "mitte"].forEach(function (t) {
  if (!typenGesehen[t])
    fail("TYPEN: Typ '" + t + "' kam in " + RUNS + " Runs je Stufe nicht vor");
});

console.log("grundkonstruktionen: " + DIFFS.length + " Stufen x " + RUNS + " Runs = " + runs + " Faelle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("GRUNDKONSTRUKTIONEN_OK");
