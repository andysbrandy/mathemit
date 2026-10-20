/* Mathemit Test-Harness für lagebeziehungen (P1.24, H3).
 * Prüft mathematische und didaktische Korrektheit aller 3 Aufgabentypen
 * (Punkt–Gerade, Gerade–Gerade, Punkt–Gerade-Abstand) über alle
 * Schwierigkeitsgrade hinweg.
 *
 * Aufruf: node scripts/test-lagebeziehungen.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.lagebeziehungen;

if (!gen) {
  console.log("FEHLER: GEN.lagebeziehungen nicht gefunden.");
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

/* Alle SVG-Linien (x1,y1,x2,y2) einsammeln – nur Inhaltslinien (kein Raster) */
function svgLines(svg) {
  var out = [], re = /<line x1="(-?[\d.]+)" y1="(-?[\d.]+)" x2="(-?[\d.]+)" y2="(-?[\d.]+)" stroke="(?!var\(--paper\))[^"]*"/g, m;
  while ((m = re.exec(String(svg))) !== null) {
    out.push({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] });
  }
  return out;
}
function svgCircles(svg) {
  var out = [], re = /<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)"/g, m;
  while ((m = re.exec(String(svg))) !== null) {
    out.push({ x: +m[1], y: +m[2] });
  }
  return out;
}

var typenGesehen = {};

DIFFS.forEach(function (diff) {
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

    // SVG wohlgeformt + Inhalt
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

    var lines = svgLines(ex.svg), circles = svgCircles(ex.svg);
    var gLinie = lines[0];

    // TYP_SPEZIFISCH
    if (ex.badge.indexOf("Punkt und Gerade") !== -1) {
      typenGesehen.punktGerade = true;
      if (ex.inputType !== "mc")
        fail("TYP0-INPUT diff=" + diff + " #" + i + ": erwartete mc, ist " + ex.inputType);
      if (String(ex.svg).indexOf(">P<") === -1)
        fail("TYP0-SVG diff=" + diff + " #" + i + ": Punkt P fehlt");
      if (String(ex.svg).indexOf(">g<") === -1)
        fail("TYP0-SVG diff=" + diff + " #" + i + ": Gerade g fehlt");
      // Antwort muss die tatsaechliche Lage beschreiben: liegt P auf g
      // (gleiche y-Koordinate wie die Gerade), muss die Antwort "genau auf" sagen.
      var P = circles[0];
      var aufG = Math.abs(P.y - gLinie.y1) < 0.5;
      if (aufG && ex.answer.indexOf("genau auf") === -1)
        fail("TYP0-LOGIK diff=" + diff + " #" + i + ": P liegt auf g, Antwort sagt es nicht");
      if (!aufG && ex.answer.indexOf("genau auf") !== -1)
        fail("TYP0-LOGIK diff=" + diff + " #" + i + ": P liegt NICHT auf g, Antwort behauptet es doch");
      if (!aufG && ex.answer.indexOf("nicht auf g") === -1)
        fail("TYP0-LOGIK diff=" + diff + " #" + i + ": falsche Lage-Aussage: " + ex.answer);
    } else if (ex.badge.indexOf("Gerade und Gerade") !== -1) {
      typenGesehen.geradeGerade = true;
      if (ex.inputType !== "mc")
        fail("TYP1-INPUT diff=" + diff + " #" + i + ": erwartete mc, ist " + ex.inputType);
      if (String(ex.svg).indexOf(">g<") === -1 || String(ex.svg).indexOf(">h<") === -1)
        fail("TYP1-SVG diff=" + diff + " #" + i + ": Geraden g oder h fehlen");
      // Parallel -> kein Schnittpunkt S; schneidend -> S muss gezeichnet sein.
      var parallel = ex.answer.indexOf("parallel") !== -1;
      var hatS = String(ex.svg).indexOf(">S<") !== -1;
      if (parallel && hatS)
        fail("TYP1-LOGIK diff=" + diff + " #" + i + ": parallel, aber Schnittpunkt S gezeichnet");
      if (!parallel && !hatS)
        fail("TYP1-LOGIK diff=" + diff + " #" + i + ": schneidend, aber Schnittpunkt S fehlt");
    } else if (ex.badge.indexOf("Abstand") !== -1) {
      typenGesehen.abstand = true;
      if (ex.inputType !== "number")
        fail("TYP2-INPUT diff=" + diff + " #" + i + ": erwartete number, ist " + ex.inputType);
      if (ex.unit !== "cm")
        fail("TYP2-UNIT diff=" + diff + " #" + i + ": erwartete cm, ist " + ex.unit);
      if (ex.answer < 1)
        fail("TYP2-ANTWORT diff=" + diff + " #" + i + ": Abstand muss positiv sein");
      // Der Wert darf NICHT in der Frage stehen (sonst triviale Aufgabe).
      if (String(ex.question).indexOf(String(ex.answer) + " cm") !== -1)
        fail("TYP2-FRAGE diff=" + diff + " #" + i + ": Antwortwert steht in der Frage");
      if (String(ex.svg).indexOf(">F<") === -1)
        fail("TYP2-SVG diff=" + diff + " #" + i + ": Lotfusspunkt F fehlt");
      if (String(ex.svg).indexOf("dasharray") === -1)
        fail("TYP2-SVG diff=" + diff + " #" + i + ": senkrechte Strecke PF fehlt");
      // Geometrie: Abstand im Bild (8 px = 1 cm) muss zur Antwort passen.
      var Pg = circles[0];
      var gLinie2 = lines.filter(function (l) { return l.y1 === l.y2; })[0];
      if (gLinie2) {
        var pxAbstand = Math.abs(gLinie2.y1 - Pg.y);
        if (Math.abs(pxAbstand / 8 - ex.answer) > 0.01)
          fail("TYP2-GEOMETRIE diff=" + diff + " #" + i + ": Bildabstand " + (pxAbstand / 8) +
               " cm passt nicht zur Antwort " + ex.answer + " cm");
      }
    } else {
      fail("BADGE diff=" + diff + " #" + i + ": unbekanntes Badge '" + ex.badge + "'");
    }

    // Curriculum-Key muss gesetzt sein
    if (ex.curriculumKey !== "lagebeziehungen")
      fail("CURRICULUM diff=" + diff + " #" + i + ": curriculumKey ist '" + ex.curriculumKey + "'");
  }
});
// Alle drei Typen muessen vorgekommen sein
["punktGerade", "geradeGerade", "abstand"].forEach(function (t) {
  if (!typenGesehen[t])
    fail("TYPEN: Typ '" + t + "' kam in " + RUNS + " Runs je Stufe nicht vor");
});

console.log("lagebeziehungen: " + DIFFS.length + " Stufen x " + RUNS + " Runs = " + runs + " Faelle");
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("LAGEBEZIEHUNGEN_OK");
