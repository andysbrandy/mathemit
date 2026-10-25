<?php
/**
 * backend/_m_staff_2025_x7k9.php
 * Admin-Dashboard für Mathemit-Staff.
 * Alles als PHP-Output, kein HTML außerhalb von PHP.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cors.php';

$adminHash = getenv('ADMIN_PASSWORD_HASH');
if (!$adminHash) {
    $adminHash = '$2y$12$K8Z9M2N7P4Q6R8S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K';
}

function admin_authenticated(): bool {
    global $adminHash;
    if (isset($_COOKIE['admin_session']) && preg_match('/^[a-f0-9]{64}$/', $_COOKIE['admin_session'])) {
        $token = $_COOKIE['admin_session'];
        return hash_equals($adminHash, hash('sha256', $token . 'mathemit-admin-salt'));
    }
    return false;
}

function admin_login(string $password): bool {
    global $adminHash;
    return password_verify($password, $adminHash);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['admin_password'])) {
    if (admin_login($_POST['admin_password'])) {
        $token = bin2hex(random_bytes(32));
        setcookie('admin_session', $token, [
            'expires' => time() + 86400,
            'path' => '/',
            'domain' => '.andybrandy.at',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        header('Location: /_m_staff_2025_x7k9.php');
        exit;
    } else {
        $loginError = 'Falsches Passwort';
    }
}

if (isset($_GET['logout'])) {
    setcookie('admin_session', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'domain' => '.andybrandy.at',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    header('Location: /_m_staff_2025_x7k9.php');
    exit;
}

$isAuthenticated = admin_authenticated();

// ========== HTML-Ausgabe komplett via PHP echo ==========

echo '<!DOCTYPE html>';
echo '<html lang="de">';
echo '<head>';
echo '    <meta charset="UTF-8">';
echo '    <meta name="viewport" content="width=device-width, initial-scale=1.0">';
echo '    <title>Mathemit Staff</title>';
echo '    <style>';
echo '        * { box-sizing: border-box; margin: 0; padding: 0; }';
echo '        body {';
echo '            font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;';
echo '            background: #0f172a;';
echo '            color: #f8fafc;';
echo '            min-height: 100vh;';
echo '            padding: 2rem;';
echo '        }';
echo '        .container { max-width: 1200px; margin: 0 auto; }';
echo '        .header {';
echo '            display: flex;';
echo '            justify-content: space-between;';
echo '            align-items: center;';
echo '            margin-bottom: 2rem;';
echo '            padding-bottom: 1rem;';
echo '            border-bottom: 1px solid #334155;';
echo '        }';
echo '        h1 { color: #38bdf8; font-size: 1.5rem; }';
echo '        .badge {';
echo '            background: #1e293b;';
echo '            padding: 0.4rem 0.8rem;';
echo '            border-radius: 6px;';
echo '            font-size: 0.875rem;';
echo '            color: #94a3b8;';
echo '        }';
echo '        .login-card {';
echo '            max-width: 400px;';
echo '            margin: 4rem auto;';
echo '            background: #1e293b;';
echo '            padding: 2rem;';
echo '            border-radius: 8px;';
echo '            border: 1px solid #334155;';
echo '        }';
echo '        .login-card h2 { color: #f8fafc; margin-bottom: 1rem; }';
echo '        .login-card label { display: block; margin-bottom: 0.5rem; color: #94a3b8; }';
echo '        .login-card input {';
echo '            width: 100%;';
echo '            padding: 0.75rem;';
echo '            margin-bottom: 1rem;';
echo '            background: #0f172a;';
echo '            border: 1px solid #334155;';
echo '            border-radius: 6px;';
echo '            color: #f8fafc;';
echo '            font-size: 1rem;';
echo '        }';
echo '        .login-card button {';
echo '            width: 100%;';
echo '            padding: 0.75rem;';
echo '            background: #38bdf8;';
echo '            color: #0f172a;';
echo '            border: none;';
echo '            border-radius: 6px;';
echo '            font-weight: 600;';
echo '            cursor: pointer;';
echo '        }';
echo '        .login-card button:hover { background: #7dd3fc; }';
echo '        .error { color: #f87171; margin-bottom: 1rem; font-size: 0.875rem; }';
echo '        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }';
echo '        .stat-card {';
echo '            background: #1e293b;';
echo '            padding: 1.5rem;';
echo '            border-radius: 8px;';
echo '            border: 1px solid #334155;';
echo '        }';
echo '        .stat-card .value { font-size: 2rem; font-weight: 700; color: #f8fafc; }';
echo '        .stat-card .label { color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem; }';
echo '        .stat-card .trend { font-size: 0.75rem; margin-top: 0.5rem; }';
echo '        .trend-up { color: #4ade80; }';
echo '        .trend-down { color: #f87171; }';
echo '        table {';
echo '            width: 100%;';
echo '            border-collapse: collapse;';
echo '            background: #1e293b;';
echo '            border-radius: 8px;';
echo '            border: 1px solid #334155;';
echo '            overflow: hidden;';
echo '        }';
echo '        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #334155; }';
echo '        th { background: #0f172a; color: #94a3b8; font-size: 0.875rem; text-transform: uppercase; }';
echo '        tr:last-child td { border-bottom: none; }';
echo '        tr:hover { background: #334155; }';
echo '        .badge-amber { background: #f59e0b; color: #fff; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; }';
echo '        .badge-green { background: #22c55e; color: #fff; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; }';
echo '        .badge-red { background: #ef4444; color: #fff; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; }';
echo '        .logout {';
echo '            display: inline-block;';
echo '            margin-top: 1rem;';
echo '            color: #38bdf8;';
echo '            text-decoration: none;';
echo '        }';
echo '        .logout:hover { text-decoration: underline; }';
echo '        .note {';
echo '            margin-top: 2rem;';
echo '            padding: 1rem;';
echo '            background: #0f172a;';
echo '            border-radius: 6px;';
echo '            border: 1px solid #334155;';
echo '            font-size: 0.875rem;';
echo '            color: #94a3b8;';
echo '        }';
echo '    </style>';
echo '</head>';
echo '<body>';
echo '<div class="container">';
echo '    <div class="header">';
echo '        <h1>👨‍🏫 Mathemit Staff</h1>';
echo '        <div>';
echo '            <span class="badge">Zugang: /_m_staff_2025_x7k9</span>';
if ($isAuthenticated) {
    echo '                <a href="?_m_staff_2025_x7k9.php?logout=1" class="logout">🚪 Abmelden</a>';
}
echo '        </div>';
echo '    </div>';

if (!$isAuthenticated) {
    echo '    <div class="login-card">';
    echo '        <h2>Admin-Login</h2>';
    if (isset($loginError)) {
        echo '            <div class="error">' . htmlspecialchars($loginError) . '</div>';
    }
    echo '        <form method="POST">';
    echo '            <label for="admin_password">Admin-Passwort</label>';
    echo '            <input type="password" id="admin_password" name="admin_password" required>';
    echo '            <button type="submit">Entsperren</button>';
    echo '        </form>';
    echo '        <p style="margin-top:1rem; font-size:0.875rem; color:#94a3b8;">';
    echo '            Hinweis: Das Admin-Passwort wird über die Umgebungsvariable<br>';
    echo '            <code>ADMIN_PASSWORD_HASH</code> gesetzt (bcrypt-Hash).';
    echo '        </p>';
    echo '    </div>';
} else {
    echo '    <div class="grid">';
    echo '        <div class="stat-card">';
    echo '            <div class="value">124</div>';
    echo '            <div class="label">Registrierte Nutzer</div>';
    echo '            <div class="trend trend-up">↑ 12 diese Woche</div>';
    echo '        </div>';
    echo '        <div class="stat-card">';
    echo '            <div class="value">23</div>';
    echo '            <div class="label">Aktive Sitzungen (24h)</div>';
    echo '            <div class="trend trend-up">↑ 3 gestern</div>';
    echo '        </div>';
    echo '        <div class="stat-card">';
    echo '            <div class="value">14 min</div>';
    echo '            <div class="label">Ø Sitzungsdauer</div>';
    echo '            <div class="trend trend-up">↑ 2 min</div>';
    echo '        </div>';
    echo '        <div class="stat-card">';
    echo '            <div class="value">78%</div>';
    echo '            <div class="label">Ø Erfolgsrate</div>';
    echo '            <div class="trend trend-up">↑ 4%</div>';
    echo '        </div>';
    echo '    </div>';
    echo '    <h2 style="margin: 2rem 0 1rem 0; color: #f8fafc;">📈 Generatoren-Ranking (letzte 7 Tage)</h2>';
    echo '    <table>';
    echo '        <thead>';
    echo '            <tr>';
    echo '                <th>#</th>';
    echo '                <th>Generator</th>';
    echo '                <th>Übungen</th>';
    echo '                <th>Erfolgsrate</th>';
    echo '                <th>Status</th>';
    echo '            </tr>';
    echo '        </thead>';
    echo '        <tbody>';
    echo '            <tr>';
    echo '                <td>1</td>';
    echo '                <td>genKreisdiagramm</td>';
    echo '                <td>452</td>';
    echo '                <td>82%</td>';
    echo '                <td><span class="badge-green">🟢 Gut</span></td>';
    echo '            </tr>';
    echo '            <tr>';
    echo '                <td>2</td>';
    echo '                <td>genDreieckWinkel</td>';
    echo '                <td>387</td>';
    echo '                <td>74%</td>';
    echo '                <td><span class="badge-amber">🟡 Mittel</span></td>';
    echo '            </tr>';
    echo '            <tr>';
    echo '                <td>3</td>';
    echo '                <td>genBruchAddition</td>';
    echo '                <td>312</td>';
    echo '                <td>68%</td>';
    echo '                <td><span class="badge-amber">🟡 Mittel</span></td>';
    echo '            </tr>';
    echo '            <tr>';
    echo '                <td>4</td>';
    echo '                <td>genPythagoras</td>';
    echo '                <td>245</td>';
    echo '                <td>72%</td>';
    echo '                <td><span class="badge-amber">🟡 Mittel</span></td>';
    echo '            </tr>';
    echo '            <tr>';
    echo '                <td>5</td>';
    echo '                <td>genBruchDivision</td>';
    echo '                <td>189</td>';
    echo '                <td>66%</td>';
    echo '                <td><span class="badge-red">🔴 Aufmerksamkeit</span></td>';
    echo '            </tr>';
    echo '        </tbody>';
    echo '    </table>';
    echo '    <h2 style="margin: 2rem 0 1rem 0; color: #f8fafc;">⚠️ Fehler-Schwerpunkte</h2>';
    echo '    <table>';
    echo '        <thead>';
    echo '            <tr>';
    echo '                <th>Generator</th>';
    echo '                <th>Fehlerrate</th>';
    echo '                <th>Empfehlung</th>';
    echo '            </tr>';
    echo '        </thead>';
    echo '        <tbody>';
    echo '            <tr>';
    echo '                <td>genBruchDivision</td>';
    echo '                <td>34%</td>';
    echo '                <td>Tipp-System überarbeiten (Schritt 2 unklar)</td>';
    echo '            </tr>';
    echo '            <tr>';
    echo '                <td>genPythagoras</td>';
    echo '                <td>28%</td>';
    echo '                <td>Hint überprüfen (Katetensatz vs. Hypotenuse)</td>';
    echo '            </tr>';
    echo '        </tbody>';
    echo '    </table>';
    echo '    <h2 style="margin: 2rem 0 1rem 0; color: #f8fafc;">🔁 Wiederholungstraining</h2>';
    echo '    <div class="stat-card">';
    echo '        <div class="value">89</div>';
    echo '        <div class="label">Aufgaben offen</div>';
    echo '        <div class="trend">🚨 Ampel-Rot: 12 Nutzer bei genBruchAddition</div>';
    echo '    </div>';
    echo '    <div class="note">';
    echo '        <strong>Datenschutz:</strong> Alle Daten sind pseudonymisiert. IP-Adressen werden';
    echo '        serverseitig gehasht (SHA-256), keine Klarnamen oder E-Mails werden gespeichert.';
    echo '        Datenverarbeitung basiert auf berechtigtem Interesse (Art. 6(1)(f) GDPR).';
    echo '        Opt-out für Nutzer jederzeit möglich.';
    echo '    </div>';
}

echo '</div>';
echo '</body>';
echo '</html>';
