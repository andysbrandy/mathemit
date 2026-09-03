<?php
/**
 * backend/security.php
 *
 * Zentrale Sicherheitsfunktionen für alle API-Endpunkte.
 * Einbinden nach config.php und cors.php.
 *
 * Enthält:
 *   - Rate-Limiting (pro IP, pro Endpoint)
 *   - Input-Validierung (Nickname, PIN, JSON-Body)
 *   - Client-IP-Ermittlung
 *   - Sichere Zufallsgenerierung
 *   - Token-Authentifizierung
 */

require_once __DIR__ . '/config.php';

/**
 * Liefert die reale Client-IP.
 * X-Forwarded-For wird NICHT vertraut (Clients können Header fälschen).
 * Für Reverse-Proxy-Setups müsste die Proxy-Whitelist ergänzt werden.
 */
function get_client_ip(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if ($ip === '::1') {
        $ip = '127.0.0.1';
    }
    return $ip;
}

/**
 * Prüft Rate-Limit für eine IP und einen Endpunkt.
 *
 * @param string $endpoint  z.B. 'login', 'register'
 * @param array  $limits    z.B. ['login' => [5, 900]]
 * @return bool             true = OK, false = Limit überschritten
 */
function check_rate_limit(string $endpoint, array $limits): bool {
    if (!isset($limits[$endpoint])) {
        return true;
    }

    [$max_attempts, $window_seconds] = $limits[$endpoint];
    $ip = get_client_ip();

    try {
        $pdo = get_db();

        // Alte Einträge löschen
        $cleanup = $pdo->prepare(
            'DELETE FROM login_attempts
             WHERE endpoint = ? AND attempted_at < DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $cleanup->execute([$endpoint, $window_seconds]);

        // Versuche im Zeitfenster zählen
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM login_attempts
             WHERE ip = ? AND endpoint = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$ip, $endpoint, $window_seconds]);
        $count = (int)$stmt->fetchColumn();

        if ($count >= $max_attempts) {
            header("Retry-After: $window_seconds");
            http_response_code(429);
            echo json_encode([
                'status'  => 'error',
                'message' => 'Too many requests. Please try again later.',
            ]);
            return false;
        }

        return true;

    } catch (PDOException $e) {
        http_response_code(503);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Service temporarily unavailable',
        ]);
        return false;
    }
}

/**
 * Loggt einen Rate-Limit-Eintrag (nach FEHLGESCHLAGENEM Versuch).
 */
function log_attempt(string $endpoint): void {
    try {
        $pdo = get_db();
        $stmt = $pdo->prepare(
            'INSERT INTO login_attempts (ip, endpoint) VALUES (?, ?)'
        );
        $stmt->execute([get_client_ip(), $endpoint]);
    } catch (PDOException $e) {
        // Schweigen – darf Anfrage nicht blockieren
    }
}

/**
 * Validiert JSON-Body. Beendet Skript bei Fehler mit 400.
 *
 * @param int $max_bytes Maximale Größe (Standard 1 KB)
 * @return array|null
 */
function validate_json_body(int $max_bytes = 1024): ?array {
    $raw = file_get_contents('php://input');

    if ($raw === '' || $raw === false) {
        return null;
    }

    if (strlen($raw) > $max_bytes) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Request body too large']);
        exit;
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON body']);
        exit;
    }

    return $decoded;
}

/**
 * Validiert Nickname: 2-50 Zeichen, [a-zA-Z0-9_-].
 */
function validate_nickname(string $nickname): ?string {
    $nickname = trim($nickname);
    if (strlen($nickname) < 2 || strlen($nickname) > 50) {
        return null;
    }
    if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $nickname)) {
        return null;
    }
    return $nickname;
}

/**
 * Validiert PIN: exakt 4 Ziffern.
 */
function validate_pin(string $pin): ?string {
    $pin = trim($pin);
    if (!preg_match('/^[0-9]{4}$/', $pin)) {
        return null;
    }
    return $pin;
}

/**
 * Validiert Klassen-Code: 3-12 Zeichen, [A-Z0-9], wird zu Uppercase.
 */
function validate_class_code(string $code): ?string {
    $code = strtoupper(trim($code));
    if (strlen($code) < 3 || strlen($code) > 12) {
        return null;
    }
    if (!preg_match('/^[A-Z0-9]+$/', $code)) {
        return null;
    }
    return $code;
}

/**
 * Erzeugt ein sicheres Zufalls-Token (Hex).
 */
function generate_token(int $bytes = 32): string {
    return bin2hex(random_bytes($bytes));
}

/**
 * Einheitliche "Auth fehlgeschlagen"-Meldung (gegen User-Enumeration).
 */
function auth_error(int $http_code = 401): void {
    http_response_code($http_code);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Invalid nickname or PIN',
    ]);
}

/**
 * Validiert ein Session-Token und liefert die User-Daten zurück.
 *
 * @return array|null  ['user_id' => int, 'nickname' => string, 'klasse_id' => ?int]
 */
function authenticate_token(): ?array {
    $token = null;

    // Token aus Authorization-Header (Bearer <token>)
    if (isset($_SERVER['HTTP_AUTHORIZATION'])
        && preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
        $token = $matches[1];
    }
    // Alternativ: X-API-Token Header
    elseif (isset($_SERVER['HTTP_X_API_TOKEN'])
             && preg_match('/^[a-f0-9]{64}$/i', $_SERVER['HTTP_X_API_TOKEN'])) {
        $token = $_SERVER['HTTP_X_API_TOKEN'];
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Missing authentication token',
        ]);
        return null;
    }

    try {
        $pdo = get_db();

        $stmt = $pdo->prepare(
            'SELECT s.user_id, s.expires_at, u.nickname, u.klasse_id
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.token = ?'
        );
        $stmt->execute([$token]);
        $session = $stmt->fetch();

        if (!$session) {
            auth_error(401);
            return null;
        }

        // Token abgelaufen?
        $expires = new DateTime($session['expires_at']);
        $now = new DateTime();
        if ($now >= $expires) {
            $stmt = $pdo->prepare('DELETE FROM sessions WHERE token = ?');
            $stmt->execute([$token]);
            auth_error(401);
            return null;
        }

        return [
            'user_id'   => (int)$session['user_id'],
            'nickname'  => $session['nickname'],
            'klasse_id' => $session['klasse_id'] !== null ? (int)$session['klasse_id'] : null,
        ];

    } catch (PDOException $e) {
        http_response_code(502);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Database connection failed',
        ]);
        return null;
    }
}