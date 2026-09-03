<?php
/**
 * backend/delete_account.php
 *
 * Löscht den aktuellen User und alle zugehörigen Daten (DSGVO-Recht auf Löschung).
 *
 * Anfrage:  POST /delete_account.php
 * Header:  Authorization: Bearer <token>
 * Body:    {"confirm": true}
 *
 * Antwort (200 OK):
 *   {"status":"ok","message":"Account deleted"}
 *
 * Sicherheit:
 *   - Token muss gültig sein (sonst 401)
 *   - Bestätigung erforderlich: {"confirm": true}
 *   - Löscht: sessions, progress, users (CASCADE-FK)
 *   - Rate-Limit: 1 Anfrage/Stunde (Schutz vor Missbrauch)
 *   - Kein Auto-Login mehr möglich (User ist gelöscht)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/security.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

// Rate-Limit: 1 Löschung pro Stunde
if (!check_rate_limit('delete_account', ['delete_account' => [1, 3600]])) {
    exit;
}

// Token-Authentifizierung
$user = authenticate_token();
if ($user === null) {
    exit;
}

$userId = $user['user_id'];

// Bestätigung erforderlich
$input = validate_json_body(128);
if ($input === null || ($input['confirm'] ?? false) !== true) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Deletion requires {"confirm": true}',
    ]);
    exit;
}

try {
    $pdo = get_db();
    $pdo->beginTransaction();

    // Sessions löschen
    $stmt = $pdo->prepare('DELETE FROM sessions WHERE user_id = ?');
    $stmt->execute([$userId]);

    // User löschen (CASCADE löscht auch progress)
    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$userId]);

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        'status'  => 'ok',
        'message' => 'Account deleted',
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
}