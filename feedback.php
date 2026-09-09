<?php
// Feedback-Proxy: Frontend sendet nur an feedback.php (relativ zur App), das Token bleibt auf dem Server.
// Erwartet: Environment-Variable GH_FEEDBACK_TOKEN (z. B. via .htaccess SetEnv).

// Diagnose immer mit JSON antworten (auch bei 405/500), damit das Modal Klartext zeigt.
// Wichtig: Apache kann selbst 405 liefern (z. B. PHP-Handler, mod_security) - dann
// kommt diese Datei gar nicht zur Ausfuehrung. Der Unterschied ist sichtbar:
// - Modal zeigt "HTTP 405" ohne Diagnose -> Apache blockiert, siehe Hosting-Support/PHP-Handler
// - Modal zeigt "Expected POST, received: ..." -> diese Datei lief, Methoden-Problem im Frontend

header('Content-Type: application/json');
header('Allow: POST, GET, HEAD');
header('Access-Control-Allow-Origin: ' . (isset($_SERVER['HTTPS_ORIGIN']) ? $_SERVER['HTTPS_ORIGIN'] : '*'));

// OPTIONS-Preflight nicht blockieren
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';

// Diagnose-Endpunkt: Jede Methode erlaubt, nur zum Pruefen ob PHP ueberhaupt laeuft
if ($method === 'GET') {
    http_response_code(200);
    echo json_encode([
        'status' => 'feedback.php reachable',
        'method' => $method,
        'token_set' => (getenv('GH_FEEDBACK_TOKEN') ? true : false),
        'php_version' => PHP_VERSION
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'error' => 'Method not allowed. Expected POST, received: ' . $method,
        'hint'  => 'Wird die App ueber http:// aufgerufen? Die https-Umleitung wandelt POST zu GET um.'
    ]);
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
