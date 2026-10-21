// ===== scripts/test-kreisdiagramm.js =====
// Validation suite for P1.27 Kreisdiagramm (H4)
// Mirrors test-haeufigkeit.js structure

var runs = 0;
var errors = [];

function fail(msg) {
  errors.push("Lauf " + (++runs) + ": " + msg);
}

function ggT(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { var t = b; b = a % b; a = t; }
  return a;
}

function shuffle(arr) {
  var result = arr.slice();
  for (var i = result.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = result[i]; result[i] = result[j]; result[j] = tmp;
  }
  return result;
}

console.log("test-kreisdiagramm.js loaded (minimal stub)");
