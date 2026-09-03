<?php
/**
 * backend/cleanup.php
 *
 * Löscht abgelaufene Sessions und alte Login-Versuche (älter als 30 Tage).
 * Soll per Cron-Job täglich ausgeführt werden.
 *
 * Aufruf: php backend/cleanup.php
 * Ausgabe: JSON mit Anzahl gelöschter Zeilen
 *
 * Sicherheit:
 *   - Nur ausführbar wenn $argc > 0 (CLI-Modus) oder mit geheimem Token
 *   - Keine Ausgabe von sensiblen Daten
 */

require_once __DIR__ . '/config.php';

// Optional: CLI-Schutz - nur ausführen wenn als Skript gestartet
// if (php_sapi_name() !== 'cli') {
//     http_response_code(403);
//     exit;
// }

// Alternative: Geheimer Token per ENV (für Cron-Dienste)
$cleanup_token = getenv('CLEANUP_TOKEN') ?? '';
if ($cleanup_token !== '' && ($_SERVER['HTTP_X_CLEANUP_TOKEN'] ?? '') !== $cleanup_token) {
    http_response_code(403);
    exit;
}

try {
    $pdo = get_db();

    // Abgelaufene Sessions löschen (TTL=30 Tage aus login.php)
    $stmt = $pdo->prepare('DELETE FROM sessions WHERE expires_at < NOW()');
    $stmt->execute();
    $deleted_sessions = $stmt->rowCount();

    // Alte Login-Versuche löschen (älter als 30 Tage - DSGVO)
    $stmt = $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
    $stmt->execute();
    $deleted_attempts = $stmt->rowCount();

    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'deleted_sessions' => (int)$deleted_sessions,
        'deleted_login_attempts' => (int)$deleted_attempts,
    ]);

} catch (PDOException $e) {
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
}