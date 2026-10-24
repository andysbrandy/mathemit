<?php
/**
 * backend/analytics.php
 *
 * Empfängt Lern-Analytics-Events vom Frontend (app-active.js).
 * Speichert pseudonymisierte Interaktionen serverseitig (MySQL).
 *
 * DSGVO-relevant:
 *   - IP-Adressen werden sofort gehasht (SHA-256), nicht im Klartext gespeichert
 *   - Keine persönlichen Daten (Name, E-Mail) werden erfasst
 *   - Opt-out über Consent-Änderung möglich (event_type: consent_changed)
 *   - Datenverarbeitung auf Basis von berechtigtem Interesse (Art. 6(1)(f) GDPR)
 *
 * Anfrage:  POST /analytics.php
 * Header:   Content-Type: application/json
 * Body:     {
 *   "sessionId": "abc123...",
 *   "userId": "optional-pseudonym-id",
 *   "events": [
 *     {
 *       "type": "exercise_start",
 *       "generator": "genKreisdiagramm",
 *       "difficulty": 2,
 *       "timestamp": 1712345678,
 *       "data": {...}
 *     }
 *   ]
 * }
 *
 * Antwort (200 OK):
 *   {"status":"ok","stored":3}
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';

// Nur POST erlauben
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

// JSON-Body validieren (max 64 KB für Batch-Events)
$input = validate_json_body(65536);
if ($input === null) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Request body required']);
    exit;
}

// Pflichtfelder prüfen
$sessionId = $input['sessionId'] ?? null;
$userId    = $input['userId']    ?? null; // optional, pseudonym
$events    = $input['events']    ?? null;

if (!$sessionId || !is_string($sessionId) || !is_array($events) || count($events) === 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'sessionId und events[] erforderlich']);
    exit;
}

// Client-IP ermitteln und sofort hashen (DSGVO: keine Klartext-IP speichern)
$ip = get_client_ip();
$ipHash = hash('sha256', $ip . 'mathemit-salt-2025');

try {
    $pdo = get_db();
    $pdo->beginTransaction();

    // 1. Session prüfen oder anlegen
    $stmt = $pdo->prepare('SELECT id FROM analytics_sessions WHERE id = ?');
    $stmt->execute([$sessionId]);
    $existingSession = $stmt->fetch();

    if (!$existingSession) {
        // Session neu anlegen
        $stmt = $pdo->prepare(
            'INSERT INTO analytics_sessions (id, ip_hash, started_at) VALUES (?, ?, NOW())'
        );
        $stmt->execute([$sessionId, $ipHash]);
    }

    // 2. Analytics-User finden oder anlegen (wenn userId gegeben)
    $analyticsUserId = null;
    if ($userId) {
        $stmt = $pdo->prepare('SELECT id FROM analytics_users WHERE user_id = ?');
        $stmt->execute([$userId]);
        $au = $stmt->fetch();
        if (!$au) {
            $stmt = $pdo->prepare(
                'INSERT INTO analytics_users (user_id, created_at) VALUES (?, NOW())'
            );
            $stmt->execute([$userId]);
            $analyticsUserId = (int)$pdo->lastInsertId();
        } else {
            $analyticsUserId = (int)$au['id'];
        }
    }

    // 3. Events einfügen
    $stmtEvent = $pdo->prepare(
        'INSERT INTO analytics_events (session_id, analytics_user_id, event_type, event_data, timestamp, duration_ms)
         VALUES (?, ?, ?, ?, FROM_UNIXTIME(?), ?)'
    );

    $stored = 0;
    foreach ($events as $ev) {
        $eventType = $ev['type'] ?? 'unknown';
        $eventData = isset($ev['data']) ? json_encode($ev['data']) : null;
        $eventTs   = $ev['timestamp'] ?? null;
        $duration  = $ev['durationMs'] ?? null;

        // event_type auf erlaubte Werte beschränken (Whitelist)
        $allowedTypes = [
            'chip_click', 'chip_hover', 'exercise_start', 'exercise_end',
            'hint_shown', 'answer_submitted', 'answer_correct', 'answer_wrong',
            'repeat_chip_used', 'focus_chip_set', 'consent_changed',
            'theme_switch', 'difficulty_change', 'page_view', 'error'
        ];
        if (!in_array($eventType, $allowedTypes, true)) {
            $eventType = 'unknown';
        }

        $stmtEvent->execute([
            $sessionId,
            $analyticsUserId,
            $eventType,
            $eventData,
            $eventTs ? (int)$eventTs : time(),
            $duration !== null ? (int)$duration : null
        ]);
        $stored++;

        // 4. Bei exercise_end auch in analytics_exercise_results speichern
        if ($eventType === 'exercise_end' && isset($ev['data'])) {
            $data = $ev['data'];
            $stmtResult = $pdo->prepare(
                'INSERT INTO analytics_exercise_results
                 (event_id, generator_id, difficulty, correct, answer_duration_ms,
                  hint_shown, ampere_before, ampere_after, created_at)
                 VALUES (LAST_INSERT_ID(), ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))'
            );
            $stmtResult->execute([
                $data['generator'] ?? null,
                $data['difficulty'] ?? null,
                $data['correct'] ?? null,
                $data['durationMs'] ?? null,
                $data['hintShown'] ?? null,
                $data['ampereBefore'] ?? null,
                $data['ampereAfter'] ?? null,
                $eventTs ? (int)$eventTs : time()
            ]);
        }
    }

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'stored' => $stored,
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
}