<?php
/**
 * backend/feedback.php
 *
 * Serverseitiger GitHub-Proxy für Nutzer-Feedback.
 * Frontend sendet POST {title, labels, body} an https://mapi.andybrandy.at/feedback.php;
 * dieses Skript leitet es an die GitHub-API weiter. Das GitHub-Token bleibt
 * ausschließlich auf dem Server (Environment-Variable GH_FEEDBACK_TOKEN,
 * z. B. via .htaccess SetEnv oder Hosting-Umgebungsvariablen).
 *
 * Anfrage:  POST /feedback.php
 * Body:     {"title":"Feedback: ...","labels":["feedback"],"body":"<JSON-String>"}
 *
 * Antwort:  GitHub-API-Response unverändert durchgereicht (201 Created bei Erfolg).
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';

// OPTIONS-Preflight (von cors.php bereits mit Headern beantwortet)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';

// Diagnose-Endpunkt: prüft Erreichbarkeit + Token-Setzung
if ($method === 'GET') {
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode([
        'status'      => 'feedback.php reachable',
        'method'      => $method,
        'token_set'   => (getenv('GH_FEEDBACK_TOKEN') ? true : false),
        'php_version' => PHP_VERSION
    ]);
    exit;
}

header('Content-Type: application/json');

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'error' => 'Method not allowed. Expected POST, received: ' . $method
    ]);
    exit;
}

$token = getenv('GH_FEEDBACK_TOKEN');
if (!$token) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Server configuration missing: GH_FEEDBACK_TOKEN is not set']);
    exit;
}

$body = file_get_contents('php://input');
if (!$body) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Empty request body']);
    exit;
}

$ch = curl_init('https://api.github.com/repos/andysbrandy/mathemit/issues');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => [
        'Authorization: token ' . $token,
        'Accept: application/vnd.github+json',
        'Content-Type: application/json',
        'User-Agent: Mathemit-Feedback-Proxy'
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
