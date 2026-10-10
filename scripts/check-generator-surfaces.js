/* Mathemit Generator-Registrierungs-Waechter.
 * Stellt sicher, dass JEDER neue Generator (z. B. P1.9 pythagoras) vollstaendig
 * in die UX und Gesamtlogik der App eingebunden ist. Ein Generator, der nur in
 * GEN registriert ist, aber an einer der vier Flaechen fehlt, waere fuer die
 * Nutzer unsichtbar (kein Chip) bzw. aus dem Wissensgarten/Lehrplan gefallen.
 *
 * Geprueft wird pro GEN-Key (4 harte Flaechen, alle = Exit 1 bei Fehler):
 *   1. CURRICULUM_MAP   – Lehrplan-Zuordnung (H1..I3) vorhanden
 *   2. GRADE_TAGS       – Stufen-Zuordnung vorhanden
 *   3. MODES (Chip)     – in mind. EINEM echten Topic-Chip (group !== null,
 *                         also NICHT nur im Catch-all "alles")
 *   4. GARTEN_BEREICHE  – in mind. EINEM Wissensgarten-Baum (generatoren)
 *
 * Zusaetzlich INFO (weich): jeder benutzte topic sollte einen TIPP1-Eintrag
 * haben (sonst faellt das Tipp-System auf _default). Kein Gate, aber gemeldet.
 *
 * Aufruf: node scripts/check-generator-surfaces.js  (Exit 0 = OK, 1 = Fehler)
 * Aufgerufen automatisch aus .githooks/pre-commit (sofern node verfuegbar).
 */
global.window = {};
require("../app-base.js");
var MB = window.MB;
var GEN = MB.GEN, MODES = MB.MODES, GARTEN = MB.GARTEN_BEREICHE;
var CMAP = MB.CURRICULUM_MAP, GTAGS = MB.GRADE_TAGS, TIPP = MB.TIPP1_BY_TOPIC;

var genKeys = Object.keys(GEN);
// Echte Topic-Chips: MODES ohne den Catch-all (group === null, z. B. "alles").
// Ein Generator muss in mind. einem ECHTEN Chip auftauchen, nicht nur im
// Alle-Modi-Pool.
var topicModes = MODES.filter(function (m) { return m.group !== null; });

var errors = [];
var topicsUsed = {};

function missing(flaeche, key) {
  errors.push(flaeche + ": '" + key + "' fehlt – Generator waere unvollstaendig " +
    "eingebunden.");
}

genKeys.forEach(function (k) {
  if (!CMAP[k]) missing("CURRICULUM_MAP", k);
  if (!GTAGS[k]) missing("GRADE_TAGS", k);
  if (!topicModes.some(function (m) { return m.pool.indexOf(k) !== -1; }))
    missing("MODES (Chip)", k);
  if (!GARTEN.some(function (b) { return b.generatoren.indexOf(k) !== -1; }))
    missing("GARTEN_BEREICHE (Wissensgarten)", k);
  try {
    var ex = GEN[k](2);
    if (ex && ex.topic) topicsUsed[ex.topic] = true;
  } catch (e) { /* Rechenlogik prueft konsistenz-check.js; hier nur Registrierung. */ }
});

// Weiche Info: Topics ohne eigenen Tipp1 (faellt auf _default).
var tipOhne = Object.keys(topicsUsed).filter(function (t) { return !TIPP[t]; }).sort();

console.log("Registrierungs-Waechter: " + genKeys.length + " Generatoren | " +
  topicModes.length + " Topic-Chips | " + GARTEN.length + " Wissensgarten-Baeume");

if (tipOhne.length) {
  console.log("INFO: Topics ohne eigenen TIPP1 (nutzen _default): " + tipOhne.join(", "));
}

if (errors.length) {
  console.log("FEHLER (" + errors.length + ") – Generator unvollstaendig eingebunden:");
  errors.forEach(function (e) { console.log(" - " + e); });
  console.log("Hinweis: Ein neuer Generator gehoert in GEN, CURRICULUM_MAP, " +
    "GRADE_TAGS, einen MODES-Chip und einen GARTEN_BEREICHE-Baum.");
  process.exit(1);
}
console.log("SURFACES_OK");
