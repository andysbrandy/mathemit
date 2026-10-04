/*
 * Mock und Timer-Ueberwachung fuer den Test der Warteschlange.
 *
 * Diese Datei wird von test/queue-sync.test.js VOR die echten
 * App-Skripte in die echte index.html eingefuegt. Es gibt bewusst KEINE
 * eigene Testseite: eine nachgebaute Seite hatte beim ersten Versuch zu
 * wenig DOM, woran app-active.js beim Start abbrach — und damit lief der
 * gesamte Code unterhalb der Abbruchstelle nie. Die Tests waren gruen
 * und prueften trotzdem nichts: der localStorage-Schluessel war dann
 * literally "undefined".
 *
 * Der Test laeuft also gegen die echte Seite mit vollstaendigem DOM.
 */

/* Zaehlt jeden Aufruf, liefert den gesetzten Status. */
window.__POSTS = [];
window.__MOCK = { status: 200 };

/*
 * Timer: kurze Delays laufen WIRKLICH (dazu gehoert das 5-ms-Resolve des
 * Mocks), lange werden nur gemerkt. Das sind die Backoff-Versuche der
 * Warteschlange (5s, 20s, 60s, 5min) — ohne das wuerde der Test am Ende
 * minuetlang warten, obwohl der Sendeerfolg schon geprueft ist.
 */
var ECHT = window.setTimeout.bind(window);
window.__TIMER = [];
window.setTimeout = function (fn, ms) {
  if (ms >= 1000) { window.__TIMER.push({ fn: fn, ms: ms }); return window.__TIMER.length; }
  return ECHT(fn, ms);
};
window.clearTimeout = function (id) { if (window.__TIMER[id - 1]) window.__TIMER[id - 1].weg = true; };
window.setInterval = function () { return 0; };

function mockApiFetch(endpoint, options) {
  return new Promise(function (resolve) {
    var koerper = options && options.body ? JSON.parse(JSON.stringify(options.body)) : null;
    window.__POSTS.push({ endpoint: endpoint, koerper: koerper });
    var status = window.__MOCK.status || 200;
    ECHT(function () {
      resolve({ status: status === 200 ? 'ok' : 'error', _httpStatus: status });
    }, 5);
  });
}

/*
 * Wichtig: app-active.js deklariert SELBST ein globales apiFetch und
 * ueberschreibt damit jeden vorher gesetzten Mock. Deshalb wird er erst
 * NACH dem Laden der App zugewiesen — sonst laeuft der Test gegen echte
 * Netzaufrufe (sichtbar als CORS-Fehler auf mapi.andybrandy.at).
 */
window.addEventListener("load", function () { window.apiFetch = mockApiFetch; });