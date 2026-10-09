/* P1.9 Satz des Pythagoras — Stabilitäts-/Korrektheitstest (200 Laeufe).
 *
 * Geht ueber den allgemeinen Konsistenz-Check hinaus: prueft die Mathematik.
 * Pro Lauf (diff 1/2/3) wird verifiziert:
 *   1. Pflichtfelder (question/hint/svg/badge/answer/explanation/inputType/unit)
 *   2. answer ist eine positive GANZZAHLIGE Dreiecksseite (MS-gerecht, keine Wurzel)
 *   3. Die Tripel-Bedingung a^2 + b^2 = c^2 gilt fuer die drei Seiten des Dreiecks
 *   4. Die gesuchte Seite passt zum Fall: genau EINE Seite ist mit "?" markiert,
 *      und answer == diese Seite
 *   5. Die beiden bekannten Seiten stehen als Label im SVG, die gesuchte nicht
 *   6. Die Erklaerung enthaelt die korrekte Rechnung und endet auf "<answer> cm"
 *   7. SVG ist wohlgeformt (<svg ... </svg>) und enthaelt den rechten-Winkel-Marker
 *
 * Aufruf: node scripts/test-pythagoras.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB;
var gen = MB.GEN.pythagoras;   // withCurriculum-gewrapter Generator

var RUNS = 200, DIFFS = [1, 2, 3];
var errors = [], runs = 0;
function fail(m){ errors.push(m); }

function pflicht(key, diff, i, ex){
  ["question","hint","svg","badge","badgeColor","inputType","answer","explanation"].forEach(function(f){
    if(ex[f] === undefined || ex[f] === null || ex[f] === "")
      fail("FELD " + key + " d" + diff + " #" + i + ": " + f + " fehlt");
  });
  if(ex.inputType !== "number") fail("TYPE " + key + " d" + diff + " #" + i + ": inputType != number");
  if(ex.unit !== "cm")       fail("UNIT " + key + " d" + diff + " #" + i + ": unit != cm");
  if(String(ex.svg).indexOf("<svg") === -1 || String(ex.svg).indexOf("</svg>") === -1)
    fail("SVG " + key + " d" + diff + " #" + i + ": nicht wohlgeformt");
  if(ex.curriculumKey !== "pythagoras")
    fail("CURR " + key + " d" + diff + " #" + i + ": curriculumKey=" + ex.curriculumKey);
}

DIFFS.forEach(function(diff){
  for(var i = 0; i < RUNS; i++){
    runs++;
    var ex;
    try{ ex = gen(diff); }
    catch(e){ fail("THROW d" + diff + " #" + i + ": " + e.message); continue; }

    pflicht("pythagoras", diff, i, ex);

    var ans = ex.answer;
    // 2. positive Ganzzahl
    if(typeof ans !== "number" || !isFinite(ans) || ans <= 0 || Math.round(ans) !== ans)
      fail("ANS d" + diff + " #" + i + ": answer keine positive Ganzzahl: " + ans);

    // Seiten aus den Labels extrahieren: Labels sind [AB, BC, CA] = [a, c, b].
    // Bekannte Seiten stehen als "a = N cm"/"c = N cm"/"b = N cm", die gesuchte als "?".
    var svg = String(ex.svg);
    var bekannte = [];
    var lm = /([abc])\s*=\s*(\d+)\s*cm/g, m;
    while((m = lm.exec(svg)) !== null){
      bekannte.push({seite:m[1], wert:parseInt(m[2],10)});
    }
    var frage = 0;   // Anzahl "?" im SVG-Text (Seitenlabel)
    var qm = />\s*\?\s*</g;
    while(qm.exec(svg) !== null) frage++;

    if(bekannte.length !== 2)
      fail("LBL d" + diff + " #" + i + ": erwarte 2 bekannte Seitenlabels, fand " + bekannte.length);
    if(frage !== 1)
      fail("LBL d" + diff + " #" + i + ": erwarte genau 1 '?'-Seitenlabel, fand " + frage);

    if(bekannte.length === 2){
      var s = {};
      bekannte.forEach(function(k){ s[k.seite] = k.wert; });
      // gesuchte Variable = die unter a/b/c, die NICHT unter den bekannten ist.
      var gesuchtVar = null;
      ["a","b","c"].forEach(function(v){ if(s[v] === undefined) gesuchtVar = v; });
      if(gesuchtVar === null){
        fail("SEITEN d" + diff + " #" + i + ": keine gesuchte Variable erkannt " + JSON.stringify(s));
      } else {
        s[gesuchtVar] = ans;   // Antwort füllt die gesuchte Seite
        // Tripel-Bedingung: genau dann, wenn answer korrekt ist, gilt a^2+b^2=c^2.
        var aa = s["a"], bb = s["b"], cc = s["c"];
        if(aa === undefined || bb === undefined || cc === undefined){
          fail("SEITEN d" + diff + " #" + i + ": unvollstaendiges Tripel " + JSON.stringify(s));
        } else if(aa*aa + bb*bb !== cc*cc){
          fail("TRIPEL d" + diff + " #" + i + ": gesucht=" + gesuchtVar +
               " answer=" + ans + " -> " + aa + "^2+" + bb + "^2 != " + cc + "^2");
        }
      }
    }

    // 6. Erklaerung: korrekte Rechnung, endet auf "<answer> cm".
    var erl = String(ex.explanation);
    if(erl.indexOf(ans + " cm") === -1)
      fail("ERKL d" + diff + " #" + i + ": Erklaerung endet nicht auf '" + ans + " cm': " + erl);

    // 7. rechter-Winkel-Marker vorhanden (Pythagoras braucht rechten Winkel).
    if(svg.indexOf("right-angle") === -1 && svg.indexOf("rechter") === -1)
      fail("RECHTER d" + diff + " #" + i + ": kein rechter-Winkel-Marker im SVG");
  }
});

// Verteilungs-Check: alle drei Faelle (Hypotenuse / Kathete a / Kathete b) kamen vor.
var fallH = 0, fallA = 0, fallB = 0;
for(var k = 0; k < 300; k++){
  var e2 = gen(2), q = String(e2.question);
  if(q.indexOf("Hypotenuse") !== -1) fallH++;
  else if(q.indexOf("Kathete a") !== -1) fallA++;
  else if(q.indexOf("Kathete b") !== -1) fallB++;
}
if(fallH === 0 || fallA === 0 || fallB === 0)
  fail("VERTEILUNG: nicht alle 3 Faelle kamen vor (H=" + fallH + " a=" + fallA + " b=" + fallB + ")");

if(errors.length){
  console.error("PYTHAGORAS-FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function(m){ console.error("  " + m); });
  if(errors.length > 30) console.error("  ... und " + (errors.length - 30) + " weitere");
  process.exit(1);
}
console.log("PYTHAGORAS_OK | Laeufe: " + runs + " | Faelle H/a/b: " + fallH + "/" + fallA + "/" + fallB);
process.exit(0);
