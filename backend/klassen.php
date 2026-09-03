<?php
/**
 * backend/klassen.php
 *
 * Verwaltung von Klassen-Codes.
 *
 * Endpunkte:
 *   GET  /klassen.php          → Liste aller Klassen (optional Filter)
 *   POST /klassen.php          → Neue Klasse anlegen (Body: {code?, lehrer_email?})
 *   GET  /klassen.php?code=XYZ → Details einer bestimmten Klasse
 *
 * Antwort-Format immer: {"status":"ok","data":{...}} oder {"status":"error","message":"..."}
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

// Nur GET und POST zulassen
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

try {
    $pdo = get_db();

    if ($method === 'GET') {
        // Optional: Filter nach code
        $code = isset($_GET['code']) ? trim($_GET['code']) : null;

        if ($code) {
            // Einzelne Klasse holen
            $stmt = $pdo->prepare(
                'SELECT id, code, lehrer_email, created_at FROM klassen WHERE code = ?'
            );
            $stmt->execute([strtoupper($code)]);
            $klasse = $stmt->fetch();

            if (!$klasse) {
                http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Klasse nicht gefunden']);
                exit;
            }

            http_response_code(200);
            echo json_encode([
                'status' => 'ok',
                'data'   => [
                    'id'         => (int)$klasse['id'],
                    'code'       => $klasse['code'],
                    'lehrer_email'=> $klasse['lehrer_email'],
                    'created_at' => $klasse['created_at'],
                ],
            ]);
        } else {
            // Alle Klassen auflisten
            $stmt = $pdo->query('SELECT id, code, lehrer_email, created_at FROM klassen ORDER BY created_at DESC');
            $klassen = $stmt->fetchAll(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'status' => 'ok',
                'data'   => array_map(function ($k) {
                    return [
                        'id'         => (int)$k['id'],
                        'code'       => $k['code'],
                        'lehrer_email'=> $k['lehrer_email'],
                        'created_at' => $k['created_at'],
                    ];
                }, $klassen),
            ]);
        }
    } elseif ($method === 'POST') {
        // Neue Klasse anlegen
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);

        if (!is_array($input)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid JSON body']);
            exit;
        }

        // Optional: vordefinierten Code akzeptieren, sonst generieren
        $code = isset($input['code']) ? strtoupper(trim($input['code'])) : null;
        $lehrer_email = isset($input['lehrer_email']) ? trim($input['lehrer_email']) : null;

        // Wenn kein Code gegeben, 6-stelligen alphanumerischen Code generieren
        if (!$code) {
            $code = '';
            $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // vermeide verwechselbare Zeichen
            for ($i = 0; $i < 6; $i++) {
                $code .= $chars[random_int(0, strlen($chars) - 1)];
            }
        }

        // Einfache Validierung
        if (strlen($code) < 3 || strlen($code) > 12) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Code must be 3-12 characters']);
            exit;
        }

        // Prüfen ob Code bereits existiert
        $stmt = $pdo->prepare('SELECT id FROM klassen WHERE code = ?');
        $stmt->execute([$code]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['status' => 'error', 'message' => 'Code already exists']);
            exit;
        }

        // Klasse einfügen
        $stmt = $pdo->prepare(
            'INSERT INTO klassen (code, lehrer_email) VALUES (?, ?)'
        );
        $stmt->execute([$code, $lehrer_email]);

        $newId = $pdo->lastInsertId();

        http_response_code(201);
        echo json_encode([
            'status' => 'ok',
            'data'   => [
                'id'         => (int)$newId,
                'code'       => $code,
                'lehrer_email'=> $lehrer_email,
                'created_at' => date('Y-m-d H:i:s'),
            ],
        ]);
    }

} catch (PDOException $e) {
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Internal server error']);
}