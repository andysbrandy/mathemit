<?php
/**
 * backend/login.php
 *
 * Authentifiziert einen Nutzer mit Nickname + PIN.
 * Gibt bei Erfolg ein Session-Token (64 Zeichen, Hex) zurück.
 *
 * Anfrage:  POST /login.php
 * Body:    {"nickname": "max", "pin": "1234"}
 *
 * Antwort (200 OK):
 *   {"status":"ok","token":"<64-char-hex>","user":{"id":1,"nickname":"max","klasse_id":2}}
 *
 * Antwort (401 Unauthorized):
 *   {"status":"error","message":"Invalid nickname or PIN"}
 *
 * Sicherheit:
 *   - Rate-Limit: 5 Login-Versuche pro IP/15 Min
 *   - PIN mit password_verify() geprüft (bcrypt)
 *   - Token: 64 Hex-Zeichen aus random_bytes(32)
 *   - TTL: 30 Tage
 *   - User-Enumeration-Schutz: gleiche Fehlermeldung bei "User existiert nicht" / "PIN falsch"
 *   - Timing-Attack-Schutz: künstliche Verzögerung bei unbekanntem User
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/security.php';

// Nur POST erlauben
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

// Rate-Limit: 5 Login-Versuche pro 15 Min pro IP
if (!check_rate_limit('login', ['login' => [5, 900]])) {
    exit;
}

// JSON-Body validieren
$input = validate_json_body(512);
if ($input === null) {
    log_attempt('login');
    auth_error(400);
    exit;
}

$nickname_raw = $input['nickname'] ?? '';
$pin_raw      = $input['pin']      ?? '';

// Validierung (länge, charset)
$nickname = validate_nickname((string)$nickname_raw);
$pin      = validate_pin((string)$pin_raw);

if ($nickname === null || $pin === null) {
    log_attempt('login');
    auth_error(400);
    exit;
}

try {
    $pdo = get_db();

    // Nutzer per Nickname suchen
    $stmt = $pdo->prepare(
        'SELECT id, klasse_id, nickname, pin_hash FROM users WHERE nickname = ?'
    );
    $stmt->execute([$nickname]);
    $user = $stmt->fetch();

    // Timing-Attack-Schutz: Wenn User nicht existiert, trotzdem password_verify
    // mit Dummy-Hash aufrufen, damit die Antwortzeit gleich bleibt.
    if (!$user) {
        password_verify($pin, '$2y$12$' . str_repeat('a', 53));
        log_attempt('login');
        auth_error(401);
        exit;
    }

    // PIN prüfen
    if (!password_verify($pin, $user['pin_hash'])) {
        log_attempt('login');
        auth_error(401);
        exit;
    }

    // PIN-Hash ggf. updaten (bei veralteter Hash-Stärke)
    if (password_needs_rehash($user['pin_hash'], PASSWORD_DEFAULT, ['cost' => 12])) {
        $new_hash = password_hash($pin, PASSWORD_DEFAULT, ['cost' => 12]);
        $stmt = $pdo->prepare('UPDATE users SET pin_hash = ? WHERE id = ?');
        $stmt->execute([$new_hash, $user['id']]);
    }

    // Session-Token generieren
    $token = generate_token(32);

    // Session in DB speichern (TTL = 30 Tage)
    $ttl_days = 30;
    $expires_at = date('Y-m-d H:i:s', time() + ($ttl_days * 86400));

    $stmt = $pdo->prepare(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
    );
    $stmt->execute([$token, $user['id'], $expires_at]);

    // Erfolgs-Antwort
    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'token'  => $token,
        'user'   => [
            'id'        => (int)$user['id'],
            'nickname'  => $user['nickname'],
            'klasse_id' => $user['klasse_id'] !== null ? (int)$user['klasse_id'] : null,
        ],
    ]);

} catch (PDOException $e) {
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
}