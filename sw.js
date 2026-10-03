/*
 * sw.js — Service Worker: Offline-Start und Update-Erkennung (5.2).
 *
 * Grundsatz: Diese App ist eine Lern-App fuer 10- bis 14-Jaehrige, oft auf
 * einem geteilten Familienhandy in der Bahn. "Seite laedt nicht" ist hier
 * kein kosmetisches Problem, sondern heisst "nicht gelernt". Deshalb
 * startet die App offline, sobald sie einmal online war.
 *
 * Zwei Dinge, die dieser Worker bewusst NICHT tut:
 *
 * 1) Er cachet KEINE Backend-Anfragen. /backend/ laeuft auf einem anderen
 *    Host und ist POST-only. Ein gecachter Fortschritt waere stiller
 *    Datenverlust: local waere er da, in der DB nicht, und der Nutzer
 *    glaubt, alles sei gespeichert. Ohne Netz meldet die App
 *    "Netzwerkfehler", localStorage bleibt die Wahrheit (5.2 Punkt 3,
 *    Offline-Write-Queue — bewusst noch nicht gebaut).
 *
 * 2) Er spielt keine veralteten JavaScript-Dateien aus, ohne zu fragen.
 *    app-base.js/app-active.js werden per ?v=NUMMER geladen. Liefert der
 *    Worker die alte Datei, laeuft die App wochenlang mit altem Code.
 *    Deshalb: Cache-First nur fuer Unveraenderliches. App-Code ist
 *    Network-First mit Cache als Notnagel.
 */

/* Der Cache-Name haengt an der Registrierungs-URL: die Seite registriert
 * sw.js mit "?v=<VERSION>". Bei jedem Deploy ist das eine andere URL, der
 * Browser meldet einen neuen Worker, und der alte Cache wird entsorgt.
 * Ohne das haetten wir nach drei Deploys drei tote Cache-Versionen. */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = "mathemit-" + VERSION;

const KERN = [
  "./",
  "./index.html",
  "./style-base.css",
  "./style-active.css",
  "./app-base.js",
  "./app-active.js",
  "./logo.svg",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  /* Die Rechtsseiten werden per fetch() in ein Modal geladen. Ohne sie
   * waere offline genau der Text nicht erreichbar, den man bei Kindern
   * zuerst braucht. */
  "./datenschutz.html",
  "./impressum.html",
  "./agb.html"
];

/* Unveraenderlich: aendert sich nie, also ist Cache-First gefahrlos. */
const IMMUTABEL = /\/(icon-192|icon-512|icon-maskable-512)\.png$|\/logo\.svg$|\/manifest\.webmanifest$/;

/* Nie cachen: Backend, andere Hosts, alles was nicht GET ist. */
function nichtCachen(request) {
  if (request.method !== "GET") return true;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.indexOf("/backend/") !== -1) return true;
  return false;
}

/* Query weg beim Nachschlagen: /app-active.js?v=149 und /app-active.js
 * sind dieselbe Datei. Ohne das wuerde der Cache zwei Eintraege fuellen. */
function ohneQuery(url) {
  const u = new URL(url);
  u.search = "";
  return u.href;
}
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* addAll ist ganz oder gar nichts: fehlt eine Datei, ist die
       * Installation gescheitert und die App startet offline nicht.
       * Deshalb einzeln mit add — eine 404 bei den Rechtsseiten darf die
       * Offline-Faehigkeit nicht gleich mitnehmen. */
      return Promise.all(KERN.map(function (pfad) {
        return cache.add(new Request(pfad, { cache: "reload" })).catch(function (f) {
          console.warn("[sw] nicht in den Cache:", pfad, f && f.message);
        });
      }));
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (name) {
        /* Nur eigene Caches anfassen — fremde Namen koennten im selben
         * Origin liegen und gehoeren nicht uns. */
        if (name !== CACHE && name.indexOf("mathemit-") === 0) return caches.delete(name);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (nichtCachen(request)) return;

  const url = new URL(request.url);

  /* Navigation (die App selbst): Network-First mit Cache als Notnagel.
   * Online ist immer die neueste index.html im Umlauf, offline rettet der
   * Cache den Start. */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(function (antwort) {
        const kopie = antwort.clone();
        caches.open(CACHE).then(function (cache) { cache.put(ohneQuery(request.url), kopie); });
        return antwort;
      }).catch(function () {
        return caches.match(ohneQuery(request.url)).then(function (treffer) {
          return treffer || caches.match("./index.html");
        });
      })
    );
    return;
  }

  /* Unveraenderliches: direkt aus dem Cache, kein Netz. */
  if (IMMUTABEL.test(url.pathname)) {
    event.respondWith(
      caches.match(ohneQuery(request.url)).then(function (treffer) {
        return treffer || fetch(request);
      })
    );
    return;
  }

  /* App-Code und CSS: Network-First. Neu wird sofort genommen, der alte
   * Stand dient nur als Notnagel fuer offline. */
  event.respondWith(
    fetch(request).then(function (antwort) {
      if (antwort && antwort.ok) {
        const kopie = antwort.clone();
        caches.open(CACHE).then(function (cache) { cache.put(ohneQuery(request.url), kopie); });
      }
      return antwort;
    }).catch(function () {
      return caches.match(ohneQuery(request.url));
    })
  );
});

/*
 * Update-Flow (5.2 Punkt 4): ein neuer Worker wartet, bis die Seite
 * geschlossen wird. Ohne Nachricht bliebe der Nutzer auf dem alten
 * gecachten Stand — bei einer Lern-App heisst das, er uebt mit Aufgaben,
 * die es nicht mehr gibt. Die Seite fragt gezielt nach einem Update; es
 * wird nur geantwortet, wenn wirklich eins wartet.
 */
self.addEventListener("message", function (event) {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});