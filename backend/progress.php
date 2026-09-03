<?php
/**
 * backend/progress.php
 *
 * Verwaltung des Lernfortschritts eines Nutzers.
 *
 * Endpunkte (erfordern gültiges Session-Token im Header):
 *   GET  /progress.php        → Aktuellen Fortschritt holen
 *   POST /progress.php        → Fortschritt aktualisieren (Body: JSON)
 *
 * Header: Authorization: Bearer <token>
 *       oder: X-API-Token: <token>
 *
 * Sicherheit:
 *   - Token-Validierung via authenticate_token()
 *   - Whitelist-Felder (nur erlaubte Felder werden aktualisiert)
 *   - Body-Limit: 1 KB
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/security.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

// Token-Authentifizierung
$user = authenticate_token();
if ($user === null) {
    exit;
}

$userId = $user['user_id'];

try {
    $pdo = get_db();

    if ($method === 'GET') {
        $stmt = $pdo->prepare(
            'SELECT points, streak, best_streak, solved, correct, badges, mode, grade, updated_at
             FROM progress WHERE user_id = ?'
        );
        $stmt->execute([$userId]);
        $progress = $stmt->fetch();

        if (!$progress) {
            $progress = [
                'points'      => 0,
                'streak'      => 0,
                'best_streak' => 0,
                'solved'      => 0,
                'correct'     => 0,
                'badges'      => null,
                'mode'        => null,
                'grade'       => null,
                'updated_at'  => null,
            ];
        } else {
            if ($progress['badges'] !== null) {
                $progress['badges'] = json_decode($progress['badges'], true);
            }
        }

        http_response_code(200);
        echo json_encode([
            'status' => 'ok',
            'data'   => array_merge([
                'user_id'    => $userId,
                'nickname'   => $user['nickname'],
                'klasse_id'  => $user['klasse_id'],
            ], $progress),
        ]);

    } elseif ($method === 'POST') {
        $input = validate_json_body(1024);
        if ($input === null) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Request body required']);
            exit;
        }

        // Erlaubte Felder (Whitelist)
        $allowed = ['points', 'streak', 'best_streak', 'solved', 'correct', 'badges', 'mode', 'grade'];
        $updates = [];
        $params  = [];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $input)) {
                $updates[] = "$field = ?";
                if ($field === 'badges' && $input[$field] !== null) {
                    $params[] = json_encode($input[$field]);
                } else {
                    $params[] = $input[$field];
                }
            }
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'No valid fields to update']);
            exit;
        }

        $updates[] = 'updated_at = CURRENT_TIMESTAMP';

        $stmt = $pdo->prepare('SELECT user_id FROM progress WHERE user_id = ?');
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) {
            $stmt = $pdo->prepare(
                'INSERT INTO progress (user_id, points, streak, best_streak, solved, correct, badges, mode, grade)
                 VALUES (?, 0, 0, 0, 0, 0, NULL, NULL, NULL)'
            );
            $stmt->execute([$userId]);
        }

        $sql = 'UPDATE progress SET ' . implode(', ', $updates) . ' WHERE user_id = ?';
        $params[] = $userId;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        http_response_code(200);
        echo json_encode(['status' => 'ok', 'message' => 'Progress updated successfully']);
    }

} catch (PDOException $e) {
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Internal server error']);
}