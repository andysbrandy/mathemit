<?php
/**
 * backend/register.php
 *
 * Legt einen neuen Nutzer an (Nickname + PIN, optional Klassen-Code).
 *
 * Anfrage:  POST /register.php
 * Body:    {"nickname":"max","pin":"1234","klasse_code":"ABC123"}
 *   - nickname:     2-50 Zeichen, [a-zA-Z0-9_-]
 *   - pin:          exakt 4 Ziffern
 *   - klasse_code:  optional, 3-12 Zeichen [A-Z0-9]
 *
 * Antwort (201 Created):
 *   {"status":"ok","user_id":42}
 *
 * Antwort (409 Conflict):
 *   {"status":"error","message":"Nickname already taken"}
 *
 * Sicherheit:
 *   - Rate-Limit: 3 Registrierungen pro IP/Stunde
 *   - PIN mit bcrypt cost=12 gehasht
 *   - Klassen-Code wird geprüft (muss existieren)
 *   - Nickname-Eindeutigkeit pro Klasse
 *   - Kein Auto-Login (sicherer, separater Login-Flow)
 *   - Antwort enthält keine sensiblen Daten
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

// Rate-Limit: 3 Registrierungen pro Stunde pro IP
if (!check_rate_limit('register', ['register' => [3, 3600]])) {
    exit;
}

// JSON-Body validieren (max 512 Bytes – ausreichend für nickname+pin+code)
$input = validate_json_body(512);
if ($input === null) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Request body required']);
    exit;
}

// Whitelist-Felder
$nickname_raw = $input['nickname'] ?? '';
$pin_raw      = $input['pin']      ?? '';
$class_code   = $input['klasse_code'] ?? null;

// Validierung
$nickname = validate_nickname((string)$nickname_raw);
$pin      = validate_pin((string)$pin_raw);

if ($nickname === null) {
    log_attempt('register');
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Invalid nickname (2-50 chars, letters/digits/_/-)',
    ]);
    exit;
}

if ($pin === null) {
    log_attempt('register');
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Invalid PIN (must be exactly 4 digits)',
    ]);
    exit;
}

$klasse_id = null;
if ($class_code !== null && $class_code !== '') {
    $code = validate_class_code((string)$class_code);
    if ($code === null) {
        log_attempt('register');
        http_response_code(400);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Invalid class code',
        ]);
        exit;
    }
    // Code wird später geprüft, hier erstmal nur speichern
    $class_code = $code;
}

try {
    $pdo = get_db();

    // Klassen-Code prüfen, falls angegeben
    if ($class_code !== null) {
        $stmt = $pdo->prepare('SELECT id FROM klassen WHERE code = ?');
        $stmt->execute([$class_code]);
        $klasse = $stmt->fetch();

        if (!$klasse) {
            // Timing-Attack-Schutz: künstlich etwas Zeit verstreichen lassen
            password_verify($pin, '$2y$12$' . str_repeat('a', 53));
            log_attempt('register');
            http_response_code(400);
            echo json_encode([
                'status'  => 'error',
                'message' => 'Class code not found',
            ]);
            exit;
        }
        $klasse_id = (int)$klasse['id'];
    }

    // Prüfen, ob Nickname in dieser Klasse bereits existiert
    $stmt = $pdo->prepare(
        'SELECT id FROM users WHERE nickname = ? AND (klasse_id = ? OR (klasse_id IS NULL AND ? IS NULL))'
    );
    $stmt->execute([$nickname, $klasse_id, $klasse_id]);
    $existing = $stmt->fetch();

    if ($existing) {
        log_attempt('register');
        http_response_code(409);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Nickname already taken',
        ]);
        exit;
    }

    // PIN hashen mit bcrypt cost=12
    $pin_hash = password_hash($pin, PASSWORD_DEFAULT, ['cost' => 12]);

    if ($pin_hash === false) {
        http_response_code(500);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Could not process registration',
        ]);
        exit;
    }

    // User einfügen
    $stmt = $pdo->prepare(
        'INSERT INTO users (klasse_id, nickname, pin_hash) VALUES (?, ?, ?)'
    );
    $stmt->execute([$klasse_id, $nickname, $pin_hash]);

    $new_user_id = (int)$pdo->lastInsertId();

    // Erfolgreich – 201 Created
    http_response_code(201);
    echo json_encode([
        'status'  => 'ok',
        'user_id' => $new_user_id,
    ]);

} catch (PDOException $e) {
    // Spezifische Fehler abfangen: Duplicate Entry (Unique-Constraint)
    if ($e->errorInfo[1] === 1062) {
        log_attempt('register');
        http_response_code(409);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Nickname already taken',
        ]);
        exit;
    }

    http_response_code(502);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Database connection failed',
    ]);
}