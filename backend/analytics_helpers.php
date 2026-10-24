<?php
/**
 * backend/analytics_helpers.php
 * Hilfsfunktionen fuer das Analytics-System (P9)
 */

/** 
 * Geraetetyp detectieren
 */
function mb_get_device_type(): string {
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    if (preg_match('/(android|ipad|ipod|iphone|opera mini|webos)/i', $ua)) {
        return 'mobile';
    }
    if (preg_match('/linux/i', $ua)) {
        return 'tablet';
    }
    return 'desktop';
}

/** 
 * Browser detektieren
 */
function mb_get_browser(string $ua): string {
    if (preg_match('/\\.(flock|iemobile)/i', $ua)) return 'IEMobile';
    if (preg_match('/edg/i', $ua)) return 'Edge';
    if (preg_match('/chrome/i', $ua)) return 'Chrome';
    if (preg_match('/firefox/i', $ua)) return 'Firefox';
    if (preg_match('/safari/i', $ua)) return 'Safari';
    if (preg_match('/opr/i', $ua)) return 'Opera';
    return 'Unknown';
}

/** 
 * Anonymous ISO-3166 Land-Kennung auf Basis von IP (Mock)
 */
function mb_get_country_iso2(): string {
    return 'AT';
}

/** 
 * Validiert JSON-Body (mit Groesse-Grenze)
 */
function mb_validate_json_body(int $maxSize = 65536): ?array {
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > $maxSize) {
        return null;
    }
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }
    return $data;
}
