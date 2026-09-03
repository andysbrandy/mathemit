<?php
/**
 * CORS- und Security-Header für alle API-Endpunkte.
 *
 * In jedem Endpunkt ganz am Anfang (in dieser Reihenfolge) einbinden:
 *   require_once __DIR__ . '/config.php';   // definiert ALLOWED_ORIGIN
 *   require_once __DIR__ . '/cors.php';
 *
 * Wichtig: Wir erlauben absichtlich nur EINE konkrete Origin
 * (https://mathemit.andybrandy.at), nicht "*" – das Backend verwaltet
 * Login-Daten und Kinder-Fortschritt, deshalb darf wirklich nur die
 * eigene App zugreifen (siehe Kapitel 9.2 der Doku).
 */

// --- CORS ---
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400'); // Preflight 24h cachen

// --- Security-Header ---
// Verhindert MIME-Sniffing – Browser muss Content-Type respektieren
header('X-Content-Type-Options: nosniff');
// Verhindert Einbettung in <iframe> (Clickjacking-Schutz)
header('X-Frame-Options: DENY');
// Referrer nur bei gleichem Origin oder HTTPS→HTTPS übertragen
header('Referrer-Policy: strict-origin-when-cross-origin');
// HTTPS für 1 Jahr erzwingen (inkl. Subdomains)
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
// Erlaubte Browser-Features einschränken
header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()');
// Eingeschränkte CSP – Backend liefert kein HTML, also nur JSON
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

header('Content-Type: application/json; charset=utf-8');

// Browser schicken vor "echten" Anfragen (v. a. bei POST mit JSON-Body
// oder einem Authorization-Header) zuerst eine unsichtbare OPTIONS-
// "Preflight"-Anfrage. Die beantworten wir sofort leer mit 204 –
// ohne weitere Logik auszuführen – damit der Browser die eigentliche
// Anfrage danach durchlässt.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
