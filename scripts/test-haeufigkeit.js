/* Mathemit Test-Harness für Häufigkeiten (P1.26, H4).
 * Prüft den Generator `haeufigkeit` (absolute & relative Häufigkeiten) über
 * alle Schwierigkeitsgrade hinweg:
 *   - absolute Häufigkeit: Antwort == Tabellenwert der gefragten Kategorie
 *   - Gesamtmenge:         Antwort == Summe aller Anzahlen
 *   - relative Häufigkeit: Antwort == Anzahl : Gesamtzahl · 100 (ganzzahlig)
 *   - Anteil als Bruch:    Antwort == gekürztes Verhältnis Anzahl : Gesamtzahl
 *   - Vergleich:           Antwort == Kategorie mit der größten Häufigkeit
 *
 * Aufruf: node scripts/test-haeufigkeit.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var gen = GEN.haeufigkeit;

if (!gen) {
  console.log("FEHLER: GEN.haeufigkeit nicht gefunden.");
  process.exit(1);
}

var errors = [], runs = 0;
var DIFFS = [1, 2, 3], RUNS = 60;
function fail(m) { errors.push(m); }

/* Alle <text>-Inhalte eines SVG einsammeln */
function svgTexts(svg) {
  var out = [], re = />\s*([^<>{}]+?)\s*</g, m;
  while ((m = re.exec(String(svg))) !== null) {
    var t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}

/* Anzahlen aus der Abbildung auslesen.
 * Tabelle: [kopf1, kopf2, kategorie1, anzahl1, ...]
 * Balkendiagramm: [kategorie1, anzahl1, ...] */
function zahlenAusSvg(svg) {
  var texts = svgTexts(svg);
  var istTabelle = texts.indexOf("Anzahl") !== -1;
  var counts = [], items = [];
  if (istTabelle) {
    for (var i = 2; i + 1 < texts.length; i += 2) {
      items.push(texts[i]);
      counts.push(parseInt(texts[i + 1], 10));
    }
  } else {
    for (var j = 0; j + 1 < texts.length; j += 2) {
      items.push(texts[j]);
      counts.push(parseInt(texts[j + 1], 10));
    }
  }
  return { items: items, counts: counts, istTabelle: istTabelle };
}

function groessterIndex(arr) {
  var idx = 0;
  for (var i = 1; i < arr.length; i++) if (arr[i] > arr[idx]) idx = i;
  return idx;
}

function ggT(a, b) { return b === 0 ? a : ggT(b, a % b); }

var typenGesehen = {};
DIFFS.forEach(function (diff) {
  for (var i = 0; i < RUNS; i++) {
    runs++;
    var ex;
    try { ex = gen(diff); }
    catch (e) { fail("THROW diff=" + diff + " #" + i + ": " + e.message); continue; }

    ["question", "hint", "svg", "badge", "badgeColor", "inputType", "answer", "explanation"].forEach(function (f) {
      if (ex[f] === undefined || ex[f] === null || ex[f] === "")
        fail("FELD diff=" + diff + " #" + i + ": " + f + " fehlt");
    });

    if (ex.inputType !== "mc" && ex.inputType !== "number")
      fail("INPUTTYPE diff=" + diff + " #" + i + ": unerwartet " + ex.inputType);

    var z = zahlenAusSvg(ex.svg);
    if (!z.counts.length || z.counts.some(function (c) { return isNaN(c); }))
      fail("SVG diff=" + diff + " #" + i + ": keine Anzahlen auslesbar");
    if (z.counts.some(function (c) { return c <= 0; }))
      fail("SVG diff=" + diff + " #" + i + ": nicht-positive Häufigkeit");

    var total = z.counts.reduce(function (a, b) { return a + b; }, 0);

    // Die Anteile müssen in Summe 100 % ergeben und Vielfache von 5 sein
    var prozente = z.counts.map(function (c) { return c / total * 100; });
    var summePct = prozente.reduce(function (a, b) { return a + b; }, 0);
    if (Math.abs(summePct - 100) > 1e-9)
      fail("PROZENT diff=" + diff + " #" + i + ": Summe der Anteile " + summePct + " != 100");
    prozente.forEach(function (p) {
      if (Math.abs(p - Math.round(p)) > 1e-9)
        fail("PROZENT diff=" + diff + " #" + i + ": Anteil " + p + " nicht ganzzahlig");
      if (Math.round(p) % 5 !== 0)
        fail("PROZENT diff=" + diff + " #" + i + ": Anteil " + p + " kein Vielfaches von 5");
      if (p <= 0)
        fail("PROZENT diff=" + diff + " #" + i + ": nicht-positiver Anteil");
    });

    // Alle Häufigkeiten müssen verschieden sein (sonst ist der Vergleichswert nicht eindeutig)
    if (new Set(z.counts).size !== z.counts.length)
      fail("DISTINKT diff=" + diff + " #" + i + ": gleiche Häufigkeiten " + JSON.stringify(z.counts));

    // Kategorie aus der Frage (in „…" gesetzt)
    var m = /„([^“]+)“/.exec(String(ex.question || ""));
    var kategorie = m ? m[1] : null;

    var typ = "unbekannt";
    if (/Absolute Häufigkeit/.test(ex.badge)) typ = "absolut";
    else if (/Gesamtmenge/.test(ex.badge)) typ = "gesamt";
    else if (/Relative Häufigkeit/.test(ex.badge)) typ = "relativ";
    else if (/Anteil als Bruch/.test(ex.badge)) typ = "relativBruch";
    else if (/Vergleich/.test(ex.badge)) typ = "vergleich";
    typenGesehen[typ] = (typenGesehen[typ] || 0) + 1;

    /* Allgemeine Prüfungen für Multiple-Choice-Aufgaben */
    if (ex.inputType === "mc") {
      if (!Array.isArray(ex.choices) || ex.choices.length < 2)
        fail("CHOICES diff=" + diff + " #" + i + ": zu wenige Optionen");
      if (ex.choices.indexOf(ex.answer) === -1)
        fail("ANTWORT diff=" + diff + " #" + i + ": answer nicht in choices");
      if (ex.correctIndex !== ex.choices.indexOf(ex.answer))
        fail("CORRECTINDEX diff=" + diff + " #" + i + ": zeigt nicht auf answer");
      var doppelt = ex.choices.some(function (c, k) { return ex.choices.indexOf(c) !== k; });
      if (doppelt)
        fail("DOPPELT diff=" + diff + " #" + i + ": doppelte Optionen " + JSON.stringify(ex.choices));
      /* Bei Bruch-Antworten dürfen keine zwei Optionen denselben Zahlenwert haben */
      if (typ === "relativBruch") {
        function wert(s) {
          var p = String(s).split("/");
          if (p.length !== 2) return null;
          var a = parseInt(p[0], 10), b = parseInt(p[1], 10);
          if (isNaN(a) || isNaN(b) || b === 0) return null;
          return a / b;
        }
        var werte = ex.choices.map(wert);
        var korrekt = werte[ex.correctIndex];
        var gleichwertig = werte.filter(function (v) { return v !== null && v === korrekt; }).length;
        if (gleichwertig > 1)
          fail("GLEICHWERTIG diff=" + diff + " #" + i + ": mehrere Optionen mit demselben Wert " + JSON.stringify(ex.choices));
      }
    }

    if (typ === "absolut") {
      var k = z.items.indexOf(kategorie);
      if (k === -1) fail("ABSOLUT diff=" + diff + " #" + i + ": Kategorie '" + kategorie + "' nicht in der Tabelle");
      else if (ex.answer !== z.counts[k])
        fail("ABSOLUT diff=" + diff + " #" + i + ": Antwort " + ex.answer + " != Tabellenwert " + z.counts[k]);
    } else if (typ === "gesamt") {
      if (ex.answer !== total)
        fail("GESAMT diff=" + diff + " #" + i + ": Antwort " + ex.answer + " != Summe " + total);
    } else if (typ === "relativ") {
      var k2 = z.items.indexOf(kategorie);
      if (k2 === -1) fail("RELATIV diff=" + diff + " #" + i + ": Kategorie '" + kategorie + "' nicht in der Tabelle");
      else {
        var pct = z.counts[k2] / total * 100;
        if (Math.abs(pct - Math.round(pct)) > 1e-9)
          fail("RELATIV diff=" + diff + " #" + i + ": Anteil " + pct + " ist nicht ganzzahlig");
        if (ex.answer !== Math.round(pct))
          fail("RELATIV diff=" + diff + " #" + i + ": Antwort " + ex.answer + " != " + Math.round(pct));
      }
    } else if (typ === "relativBruch") {
      var k3 = z.items.indexOf(kategorie);
      if (k3 === -1) fail("BRUCH diff=" + diff + " #" + i + ": Kategorie '" + kategorie + "' nicht in der Tabelle");
      else {
        var zaehler = z.counts[k3], nenner = total;
        var g = ggT(zaehler, nenner);
        var soll = (zaehler / g) + "/" + (nenner / g);
        if (ex.answer !== soll)
          fail("BRUCH diff=" + diff + " #" + i + ": Antwort " + ex.answer + " != " + soll);
      }
    } else if (typ === "vergleich") {
      var maxIdx = groessterIndex(z.counts);
      if (ex.answer !== z.items[maxIdx])
        fail("VERGLEICH diff=" + diff + " #" + i + ": Antwort '" + ex.answer + "' != größte Kategorie '" + z.items[maxIdx] + "'");
      var anzahlMax = z.counts.filter(function (c) { return c === z.counts[maxIdx]; }).length;
      if (anzahlMax !== 1)
        fail("VERGLEICH diff=" + diff + " #" + i + ": Maximum nicht eindeutig");
    }
  }
});
// Alle Typen müssen vorkommen
["absolut", "gesamt", "relativ", "relativBruch", "vergleich"].forEach(function (t) {
  if (!typenGesehen[t]) fail("TYP: '" + t + "' wurde nie erzeugt");
});

console.log("Häufigkeiten: " + runs + " Läufe | Typen: " +
  Object.keys(typenGesehen).map(function (k) { return k + "=" + typenGesehen[k]; }).join(", "));
if (errors.length) {
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function (e) { console.log(" - " + e); });
  process.exit(1);
}
console.log("HAEUFIGKEIT_OK");
