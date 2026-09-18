/* Mathemit Konsistenz-Harness — globale Pruefung aller 47 Generatoren.
 * Nutzt window.MB (app-base.js): GEN, phrase-Guards, barChartSVG-Labels.
 * Prueft pro Generator x 3 Stufen x 25 Laeufe:
 *  1. Pflichtfelder: question/hint/svg/badge/badgeColor/inputType/answer/explanation
 *     + SVG ist wohlgeformt (<svg ... </svg>)
 *  2. Begriffs-Verbote: veraltete/unerwuenschte Woerter duerfen in
 *     question/hint/explanation/svg NICHT vorkommen (z. B. "Radi" ohne "Radieschen")
 *  3. Diagramm-Label-Abgleich (genDiagrammBalken): der abgefragte Begriff
 *     (labels[qi] in question/hint/explanation) muss im SVG als Balken-Label
 *     vorkommen; alle SVG-Textlabels muessen aus der Begriffsliste stammen.
 * Aufruf: node scripts/konsistenz-check.js  (Exit 0 = OK, 1 = Fehler)
 */
global.window = {};
require("../app-base.js");
var MB = window.MB, GEN = MB.GEN;
var GEN_KEYS = Object.keys(GEN);
var RUNS = 25, DIFFS = [1, 2, 3];
var errors = [], runs = 0;
function fail(m){ errors.push(m); }

// Begriffs-Verbote (Feedback W38): Muster -> Hinweis.
var BANNED = [
  {re:/\bRadi\b(?!\w)/, fix:'"Radi" -> "Radieschen" (Kategorie im Diagramm, Ausnahme: Radius)'}
];
function checkBanned(side, text, key, diff, i){
  if(!text) return;
  var s = String(text);
  BANNED.forEach(function(b){
    if(b.re.test(s)) fail("BANNED " + key + " d" + diff + " #" + i +
      " [" + side + "]: " + b.fix);
  });
}

// SVG-Textlabels extrahieren (Texte zwischen > und <).
function svgTextLabels(svg){
  var out = [], re = />\s*([^<>{}]+?)\s*</g, m;
  while((m = re.exec(String(svg))) !== null){
    var t = m[1].trim();
    if(t && t !== "0") out.push(t);
  }
  return out;
}

GEN_KEYS.forEach(function(key){
  DIFFS.forEach(function(diff){
    for(var i = 0; i < RUNS; i++){
      runs++;
      var ex;
      try{ ex = GEN[key](diff); }
      catch(e){ fail("THROW " + key + " d" + diff + " #" + i + ": " + e.message); continue; }
      ["question","hint","svg","badge","badgeColor","inputType","answer","explanation"].forEach(function(f){
        if(ex[f] === undefined || ex[f] === null || ex[f] === "")
          fail("FELD " + key + " d" + diff + " #" + i + ": " + f + " fehlt");
      });
      if(ex.svg && String(ex.svg).indexOf("<svg") === -1)
        fail("SVG " + key + " d" + diff + " #" + i + ": kein <svg>");
      if(ex.svg && String(ex.svg).indexOf("</svg>") === -1)
        fail("SVG " + key + " d" + diff + " #" + i + ": kein </svg>");
      checkBanned("question", ex.question, key, diff, i);
      checkBanned("hint", ex.hint, key, diff, i);
      checkBanned("explanation", ex.explanation, key, diff, i);
      checkBanned("svg", ex.svg, key, diff, i);
      if(key === "diagrammBalken"){
        // Labels aus dem SVG holen und gegen Frage/Tipp/Erklaerung abgleichen.
        var txtLabels = svgTextLabels(ex.svg).filter(function(t){
          return isNaN(+t);
        });
        ["question","hint","explanation"].forEach(function(side){
          var hit = txtLabels.some(function(l){
            return String(ex[side] || "").indexOf(l) !== -1;
          });
          if(!hit) fail("LABEL " + key + " d" + diff + " #" + i +
            " [" + side + "]: kein SVG-Balkenlabel im Text. svgLabels=" +
            JSON.stringify(txtLabels.slice(0, 8)));
        });
      }
    }
  });
});
console.log("Generatoren: " + GEN_KEYS.length + " | Laeufe: " + runs);
if(errors.length){
  console.log("FEHLER (" + errors.length + "):");
  errors.slice(0, 30).forEach(function(e){ console.log(" - " + e); });
  process.exit(1);
}
console.log("KONSISTENZ_OK");
