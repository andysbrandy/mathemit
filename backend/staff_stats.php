<?php
/**
 * backend/staff_stats.php
 *
 * Liefert Live-Statistiken für das Admin-Dashboard als JSON.
 * Alle Daten stammen aus der analytics-Datenbank (echte User-Interaktionen).
 *
 * DSGVO: Keine Klartext-IPs, nur pseudonymisierte Aggregierte Daten.
 *
 * Anfrage:  GET /staff_stats.php
 * Antwort (200 OK):
 *   {
 *     "online_users": 5,
 *     "total_users": 124,
 *     "avg_session_duration": "14 min",
 *     "success_rate": "78%",
 *     "active_generators": [
 *       {"generator": "genKreisdiagramm", "users": 3},
 *       {"generator": "genDreieckWinkel", "users": 2}
 *     ],
 *     "top_generators": [
 *       {"generator": "genKreisdiagramm", "exercises": 452, "success_rate": 82, "status": "gut"},
 *       ...
 *     ]
 *   }
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';

header('Content-Type: application/json; charset=utf-8');

// Nur GET erlauben
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$view = $_GET['view'] ?? 'overview';

try {
    $pdo = get_db();

    // ========== VIEW: errors ==========
    if ($view === 'errors') {
        $stmt = $pdo->prepare(
            'SELECT e.id, e.event_type, e.event_data, e.timestamp, e.duration_ms,
                    s.id AS session_id, s.device_type, s.browser, s.current_generator
             FROM analytics_events e
             LEFT JOIN analytics_sessions s ON e.session_id = s.id
             WHERE e.event_type = :type
             ORDER BY e.timestamp DESC
             LIMIT 100'
        );
        $stmt->execute([':type' => 'error']);
        $errors = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $errors[] = [
                'id' => (int)$row['id'],
                'event_type' => $row['event_type'],
                'event_data' => $row['event_data'] ? json_decode($row['event_data'], true) : null,
                'timestamp' => $row['timestamp'],
                'duration_ms' => $row['duration_ms'],
                'session_id' => $row['session_id'],
                'device_type' => $row['device_type'],
                'browser' => $row['browser'],
                'current_generator' => $row['current_generator'],
            ];
        }
        echo json_encode(['view' => 'errors', 'count' => count($errors), 'errors' => $errors], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ========== VIEW: sessions ==========
    if ($view === 'sessions') {
        $stmt = $pdo->prepare(
            'SELECT id AS session_id, started_at, last_seen, ended_at, duration_ms,
                    device_type, browser, country, current_generator, ip_hash
             FROM analytics_sessions
             WHERE started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             ORDER BY started_at DESC
             LIMIT 200'
        );
        $stmt->execute();
        $sessions = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $sessions[] = [
                'session_id' => $row['session_id'],
                'started_at' => $row['started_at'],
                'last_seen' => $row['last_seen'],
                'ended_at' => $row['ended_at'],
                'duration_ms' => $row['duration_ms'],
                'duration_min' => $row['duration_ms'] !== null ? round($row['duration_ms'] / 60000, 1) : null,
                'device_type' => $row['device_type'],
                'browser' => $row['browser'],
                'country' => $row['country'],
                'current_generator' => $row['current_generator'],
                'ip_hash' => $row['ip_hash'] !== null ? substr($row['ip_hash'], 0, 16) . '…' : null,
            ];
        }
        echo json_encode(['view' => 'sessions', 'count' => count($sessions), 'sessions' => $sessions], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ========== VIEW: events ==========
    if ($view === 'events') {
        $stmt = $pdo->prepare(
            'SELECT event_type, COUNT(*) AS cnt,
                    ROUND(AVG(duration_ms), 1) AS avg_duration_ms
             FROM analytics_events
             WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY event_type
             ORDER BY cnt DESC'
        );
        $stmt->execute();
        $events = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $events[] = [
                'event_type' => $row['event_type'],
                'count' => (int)$row['cnt'],
                'avg_duration_ms' => $row['avg_duration_ms'] !== null ? (float)$row['avg_duration_ms'] : null,
            ];
        }
        echo json_encode(['view' => 'events', 'count' => count($events), 'events' => $events], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ========== VIEW: overview (Standard) ==========

    // 1. Online-User: Sessions mit last_seen in den letzten 5 Minuten
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) AS cnt FROM analytics_sessions
         WHERE last_seen IS NOT NULL
           AND last_seen >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
    );
    $stmt->execute();
    $onlineUsers = (int)$stmt->fetchColumn();

    // 2. Aktive Generatoren (nur online-Sessions)
    $stmt = $pdo->prepare(
        'SELECT current_generator AS generator, COUNT(*) AS users
         FROM analytics_sessions
         WHERE last_seen IS NOT NULL
           AND last_seen >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
           AND current_generator IS NOT NULL
           AND current_generator <> ""
         GROUP BY current_generator
         ORDER BY users DESC'
    );
    $stmt->execute();
    $activeGenerators = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Gesamtzahl registrierter Analytics-User
    $stmt = $pdo->query('SELECT COUNT(*) AS cnt FROM analytics_users');
    $totalUsers = (int)$stmt->fetchColumn();

    // 4. Ø Erfolgsrate (letzte 7 Tage, aus exercise_results)
    $stmt = $pdo->prepare(
        'SELECT
            ROUND(AVG(CASE WHEN correct THEN 100 ELSE 0 END), 1) AS rate,
            COUNT(*) AS total
         FROM analytics_exercise_results
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    $stmt->execute();
    $successRow = $stmt->fetch(PDO::FETCH_ASSOC);
    $successRate = $successRow['rate'] !== null ? (float)$successRow['rate'] : 0;

    // 5. Ø Sitzungsdauer (letzte 7 Tage, abgeschlossene Sessions)
    $stmt = $pdo->prepare(
        'SELECT
            ROUND(AVG(duration_ms) / 60000, 1) AS avg_min,
            COUNT(*) AS total
         FROM analytics_sessions
         WHERE duration_ms IS NOT NULL
           AND started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    $stmt->execute();
    $durationRow = $stmt->fetch(PDO::FETCH_ASSOC);
    $avgDuration = $durationRow['avg_min'] !== null ? (float)$durationRow['avg_min'] : 0;

    // 6. Top-Generatoren (letzte 7 Tage, aus exercise_results)
    $stmt = $pdo->prepare(
        'SELECT
            generator_id AS generator,
            COUNT(*) AS exercises,
            ROUND(AVG(CASE WHEN correct THEN 100 ELSE 0 END), 1) AS success_rate
         FROM analytics_exercise_results
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY generator_id
         ORDER BY exercises DESC
         LIMIT 5'
    );
    $stmt->execute();
    $topGenerators = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Status-Badge bestimmen
    $statusBadge = function (float $rate): string {
        if ($rate >= 80) return 'gut';
        if ($rate >= 60) return 'mittel';
        return 'achtung';
    };

    $result = [
        'online_users' => $onlineUsers,
        'total_users' => $totalUsers,
        'avg_session_duration' => $avgDuration . ' min',
        'success_rate' => $successRate . '%',
        'active_generators' => array_map(function ($g) {
            return [
                'generator' => $g['generator'],
                'users' => (int)$g['users'],
            ];
        }, $activeGenerators),
        'top_generators' => array_map(function ($g) use ($statusBadge) {
            $rate = (float)$g['success_rate'];
            return [
                'generator' => $g['generator'],
                'exercises' => (int)$g['exercises'],
                'success_rate' => (int)$rate,
                'status' => $statusBadge($rate),
            ];
        }, $topGenerators),
    ];

    echo json_encode($result, JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(502);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed',
    ]);
}