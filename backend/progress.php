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

    /* Spalten-Toleranz: Die Live-DB hinkt dem Repo gern hinterher (Beispiel:
     * progress.goals fehlte, obwohl Whitelist und SELECT sie nannten).
     * Ein fehlender Spaltenname wuerfe einen PDOException und der ganze
     * Abruf schluese fehl — obwohl alle anderen Felder vorhanden waeren.
     * Deshalb pruefen wir einmal pro Aufruf, welche der optionalen Spalten
     * wirklich existieren, und bauen SELECT/UPDATE nur aus diesen.
     * Pflichtspalten (kommen immer mit): points, streak, best_streak,
     * solved, correct, badges, spaced, owls, mode, grade. */
    $alleSpalten = null;
    $spaltenDa = function (string $name) use ($pdo, &$alleSpalten): bool {
        if ($alleSpalten === null) {
            try {
                $stmt = $pdo->query('SHOW COLUMNS FROM progress');
                $alleSpalten = [];
                while ($zeile = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $alleSpalten[strtolower($zeile['Field'])] = true;
                }
            } catch (PDOException $e) {
                /* SHOW scheitert? Dann nichts filtern — der Aufruf meldet
                 * sich wie bisher mit dem echten Fehler. */
                $alleSpalten = false;
            }
        }
        if ($alleSpalten === false) return true;
        return isset($alleSpalten[strtolower($name)]);
    };

    if ($method === 'GET') {
        $wunsch = ['points', 'streak', 'best_streak', 'solved', 'correct',
            'badges', 'spaced', 'owls', 'goals', 'mode', 'grade',
            'repeat_q', 'diff', 'updated_at'];
        $selectiert = [];
        foreach ($wunsch as $spalte) {
            if ($spalte === 'updated_at' || $spaltenDa($spalte)) {
                $selectiert[] = $spalte;
            }
        }
        $stmt = $pdo->prepare(
            'SELECT ' . implode(', ', $selectiert) . ' FROM progress WHERE user_id = ?'
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
                'owls'        => null,
                'goals'       => null,
                'mode'        => null,
                'grade'       => null,
                'repeat_q'    => null,
                'diff'        => null,
                'updated_at'  => null,
            ];
        } else {
            if ($progress['badges'] !== null) {
                $progress['badges'] = json_decode($progress['badges'], true);
            }
            if (isset($progress['owls']) && $progress['owls'] !== null) {
                $progress['owls'] = json_decode($progress['owls'], true);
            }
            if (isset($progress['goals']) && $progress['goals'] !== null) {
                $progress['goals'] = json_decode($progress['goals'], true);
            }
            if (isset($progress['spaced']) && $progress['spaced'] !== null) {
                $progress['spaced'] = json_decode($progress['spaced'], true);
            }
            /* 5.2 Punkt 3 — repeat_q kommt als Spaltenname mit Unterstrich
             * aus der DB, die App erwartet "repeatQ". */
            if (isset($progress['repeat_q']) && $progress['repeat_q'] !== null) {
                $progress['repeatQ'] = json_decode($progress['repeat_q'], true);
            }
            unset($progress['repeat_q']);
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
        $input = validate_json_body(65536);
        if ($input === null) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Request body required']);
            exit;
        }

        /* Erlaubte Felder (Whitelist)
         *
         * 5.2 Punkt 3: repeat_q und diff kamen hinzu. Die App hat beide
         * Felder lange gesendet, sie standen hier aber nicht — der Server
         * hat sie kommentarlos verworfen. Das Wiederholungstraining war
         * damit trotz Werbeversprechen ("geräteuebergreifend synchronisiert")
         * nicht synchronisiert.
         *
         * Die App sendet "repeatQ", die Spalte heisst "repeat_q". */
        $allowed = ['points', 'streak', 'best_streak', 'solved', 'correct', 'badges', 'spaced', 'owls', 'goals', 'mode', 'grade', 'diff', 'repeat_q'];
        $json_spalten = ['badges', 'spaced', 'owls', 'goals', 'repeat_q'];
        $updates = [];
        $params  = [];
        /* Spalten, die die Live-DB (noch) nicht hat. Sie stehen in der
         * Antwort, damit der Client weiss, was nicht ankam — statt einen
         * SQL-Fehler zu werfen und den ganzen Sync zu verweigern. */
        $uebergangen = [];

        /* camelCase -> snake_case, damit die App ihre gewohnten Feldnamen
         * schicken kann. */
        if (array_key_exists('repeatQ', $input) && !array_key_exists('repeat_q', $input)) {
            $input['repeat_q'] = $input['repeatQ'];
        }

        foreach ($allowed as $field) {
            if (array_key_exists($field, $input)) {
                /* Fehlende Spalte (Live-DB aelter als das Repo)? Dann wird das
                 * Feld still uebergangen statt den ganzen Sync zu sprengen.
                 * Gemeldet wird es in der Antwort, damit der Client weiss,
                 * was nicht ankam. */
                if (!$spaltenDa($field)) {
                    $uebergangen[] = $field;
                    continue;
                }
                $updates[] = "$field = ?";
                if (in_array($field, $json_spalten, true) && $input[$field] !== null) {
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
        $antwort = ['status' => 'ok', 'message' => 'Progress updated successfully'];
        if (!empty($uebergangen)) {
            $antwort['uebergangen'] = array_values(array_unique($uebergangen));
        }
        echo json_encode($antwort);
    }

} catch (PDOException $e) {
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Internal server error']);
}