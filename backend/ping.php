<?php
/**
 * Health-Check-Endpoint: beweist, dass PHP läuft, die Datenbank
 * erreichbar ist und CORS korrekt konfiguriert ist – bevor irgendeine
 * echte Logik (Login, Registrierung, Fortschritt) dazukommt.
 *
 * Aufruf: GET https://api.andybrandy.at/ping.php
 * Erwartete Antwort bei Erfolg: {"status":"ok","db":"connected"}
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';

try {
    $pdo = get_db();
    $stmt = $pdo->query('SELECT 1');
    $stmt->fetch();

    echo json_encode([
        'status' => 'ok',
        'db'     => 'connected',
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Datenbankverbindung fehlgeschlagen. Bitte DB_HOST/DB_NAME/DB_USER/DB_PASS in config.php prüfen.',
        // Im Produktivbetrieb NIEMALS $e->getMessage() an den Client ausgeben
        // (könnte Interna/Zugangsdaten verraten). Für die erste lokale
        // Fehlersuche kannst du die nächste Zeile kurz einkommentieren:
        // 'debug' => $e->getMessage(),
    ]);
}
