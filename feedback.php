<?php
// Feedback-Proxy: Frontend sendet nur an /feedback.php, das Token bleibt auf dem Server.
// Erwartet: Environment-Variable GH_FEEDBACK_TOKEN (z. B. via .htaccess SetEnv).

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$token = getenv('GH_FEEDBACK_TOKEN');
if (!$token) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration missing: GH_FEEDBACK_TOKEN is not set']);
    exit;
}

$body = file_get_contents('php://input');
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'Empty request body']);
    exit;
}

$ch = curl_init('https://api.github.com/repos/andybrandy/mathemit/issues');
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
