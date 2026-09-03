<?php
/**
 * Vorlage für config.php – Datenbankverbindung der Formen-Werkstatt API.
 *
 * So verwendest du diese Datei:
 * 1. Kopiere sie zu "config.php" (im selben Ordner).
 * 2. Trage in der Kopie deine echten World4You-Datenbank-Zugangsdaten ein
 *    (aus Paket 1: World4You-Kundencenter → Paket → Webspace → Datenbanken).
 * 3. "config.php" NIEMALS committen – sie steht deshalb in .gitignore.
 *    Nur diese Vorlage (config.example.php) gehört ins Repository.
 */

// ---- Diese vier Werte aus Paket 1 (World4You-Datenbank) eintragen ----
define('DB_HOST', 'localhost');            // bei World4You meist 'localhost', sonst im Kundencenter nachsehen
define('DB_NAME', 'dein_datenbank_name');
define('DB_USER', 'dein_datenbank_user');
define('DB_PASS', 'dein_datenbank_passwort');
// ------------------------------------------------------------------

// Domain deines Frontends – wird von cors.php verwendet, damit NUR
// diese eine Domain auf die API zugreifen darf (siehe Kapitel 9.2 der Doku).
define('ALLOWED_ORIGIN', 'https://mathemit.andybrandy.at');

/**
 * Liefert eine wiederverwendbare PDO-Datenbankverbindung.
 * Wirft bei einem Verbindungsfehler eine Exception – die fangen die
 * einzelnen Endpunkte ab und melden sie sauber als JSON (siehe ping.php).
 */
function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Echte, serverseitig vorbereitete Statements statt Emulation –
            // wichtig für den SQL-Injection-Schutz der Prepared Statements
            // in den späteren Paketen (Login, Registrierung, Fortschritt).
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
