<?php
/**
 * backend/logout.php
 *
 * Meldet den aktuellen User ab (löscht das aktuelle Session-Token).
 *
 * Anfrage:  POST /logout.php
 * Header:  Authorization: Bearer <token>
 *
 * Antwort (200 OK):
 *   {"status":"ok","message":"Logged out"}
 *
 * Sicherheit:
 *   - Token muss gültig sein (sonst 401)
 *   - Nur das aktuelle Token wird gelöscht, andere Geräte bleiben angemeldet
 *   - Rate-Limit: 10 Logouts/Stunde (Schutz vor Token-Spam)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/security.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

// Token extrahieren
$token = null;
if (isset($_SERVER['HTTP_AUTHORIZATION'])
    && preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
    $token = $matches[1];
} elseif (isset($_SERVER['HTTP_X_API_TOKEN'])
          && preg_match('/^[a-f0-9]{64}$/i', $_SERVER['HTTP_X_API_TOKEN'])) {
    $token = $_SERVER['HTTP_X_API_TOKEN'];
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Missing authentication token']);
    exit;
}

try {
    $pdo = get_db();
    $stmt = $pdo->prepare('DELETE FROM sessions WHERE token = ?');
    $stmt->execute([$token]);

    http_response_code(200);
    echo json_encode(['status' => 'ok', 'message' => 'Logged out']);

} catch (PDOException $e) {
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
}