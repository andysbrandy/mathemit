<?php
/**
 * backend/analytics_heartbeat.php
 *
 * Empfängt Heartbeats vom Frontend, um "wer ist gerade online" zu tracken.
 * Aktualisiert last_seen und current_generator in analytics_sessions.
 *
 * DSGVO-relevant:
 *   - IP-Adressen werden sofort gehasht (SHA-256), nicht im Klartext gespeichert
 *   - Keine persönlichen Daten werden erfasst
 *
 * Anfrage:  POST /analytics_heartbeat.php
 * Header:   Content-Type: application/json
 * Body:     {
 *   "sessionId": "abc123...",
 *   "currentGenerator": "genKreisdiagramm",
 *   "timestamp": 1712345678
 * }
 *
 * Antwort (200 OK):
 *   {"status":"ok","updated":1}
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';

// Nur POST erlauben
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

// JSON-Body validieren
$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) === 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Request body required']);
    exit;
}

$data = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

$sessionId = $data['sessionId'] ?? null;
$currentGenerator = $data['currentGenerator'] ?? null;

if (!$sessionId || !is_string($sessionId)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'sessionId erforderlich']);
    exit;
}

try {
    $pdo = get_db();

    // Session aktualisieren: last_seen + current_generator
    $stmt = $pdo->prepare(
        'UPDATE analytics_sessions
         SET last_seen = NOW(),
             current_generator = ?
         WHERE id = ?'
    );
    $stmt->execute([$currentGenerator, $sessionId]);

    $updated = $stmt->rowCount();

    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'updated' => (int)$updated,
    ]);

} catch (PDOException $e) {
    http_response_code(502);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed',
    ]);
}