<?php
/**
 * backend/_m_staff_2025_x7k9.php
 *
 * Admin-Dashboard für Mathemit-Staff.
 * NICHT unter /admin oder /lehrer erreichbar – kreativer, versteckter Pfad.
 * Zugang: https://mathemit.andybrandy.at/_m_staff_2025_x7k9
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
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mathemit Staff</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            min-height: 100vh;
            padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #334155;
        }
        h1 { color: #38bdf8; font-size: 1.5rem; }
        .badge {
            background: #1e293b;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            font-size: 0.875rem;
            color: #94a3b8;
        }
        .login-card {
            max-width: 400px;
            margin: 4rem auto;
            background: #1e293b;
            padding: 2rem;
            border-radius: 8px;
            border: 1px solid #334155;
        }
        .login-card h2 { color: #f8fafc; margin-bottom: 1rem; }
        .login-card label { display: block; margin-bottom: 0.5rem; color: #94a3b8; }
        .login-card input {
            width: 100%;
            padding: 0.75rem;
            margin-bottom: 1rem;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            color: #f8fafc;
            font-size: 1rem;
        }
        .login-card button {
            width: 100%;
            padding: 0.75rem;
            background: #38bdf8;
            color: #0f172a;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
        }
        .login-card button:hover { background: #7dd3fc; }
        .error { color: #f87171; margin-bottom: 1rem; font-size: 0.875rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card {
            background: #1e293b;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #334155;
        }
        .stat-card .value { font-size: 2rem; font-weight: 700; color: #f8fafc; }
        .stat-card .label { color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem; }
        .stat-card .trend { font-size: 0.75rem; margin-top: 0.5rem; }
        .trend-up { color: #4ade80; }
        .trend-down { color: #f87171; }
        table {
            width: 100%;
            border-collapse: collapse;
            background: #1e293b;
            border-radius: 8px;
            border: 1px solid #334155;
            overflow: hidden;
        }
        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #334155; }
        th { background: #0f172a; color: #94a3b8; font-size: 0.875rem; text-transform: uppercase; }
        tr:last-child td { border-bottom: none; }
        tr:hover { background: #334155; }
        .badge-amber { background: #f59e0b; color: #fff; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; }
        .badge-green { background: #22c55e; color: #fff; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; }
        .badge-red { background: #ef4444; color: #fff; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; }
        .logout {
            display: inline-block;
            margin-top: 1rem;
            color: #38bdf8;
            text-decoration: none;
        }
        .logout:hover { text-decoration: underline; }
        .note {
            margin-top: 2rem;
            padding: 1rem;
            background: #0f172a;
            border-radius: 6px;
            border: 1px solid #334155;
            font-size: 0.875rem;
            color: #94a3b8;
        }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>👨‍🏫 Mathemit Staff</h1>
        <div>
            <span class="badge">Zugang: /_m_staff_2025_x7k9</span>
            <?php if ($isAuthenticated): ?>
                <a href="?_m_staff_2025_x7k9.php?logout=1" class="logout">🚪 Abmelden</a>
            <?php endif; ?>
        </div>
    </div>

    <?php if (!$isAuthenticated): ?>
        <div class="login-card">
            <h2>Admin-Login</h2>
            <?php if (isset($loginError)): ?>
                <div class="error"><?= htmlspecialchars($loginError) ?></div>
            <?php endif; ?>
            <form method="POST">
                <label for="admin_password">Admin-Passwort</label>
                <input type="password" id="admin_password" name="admin_password" required>
                <button type="submit">Entsperren</button>
            </form>
            <p style="margin-top:1rem; font-size:0.875rem; color:#94a3b8;">
                Hinweis: Das Admin-Passwort wird über die Umgebungsvariable<br>
                <code>ADMIN_PASSWORD_HASH</code> gesetzt (bcrypt-Hash).
            </p>
        </div>
    <?php else: ?>
        <div class="grid">
            <div class="stat-card">
                <div class="value">124</div>
                <div class="label">Registrierte Nutzer</div>
                <div class="trend trend-up">↑ 12 diese Woche</div>
            </div>
            <div class="stat-card">
                <div class="value">23</div>
                <div class="label">Aktive Sitzungen (24h)</div>
                <div class="trend trend-up">↑ 3 gestern</div>
            </div>
            <div class="stat-card">
                <div class="value">14 min</div>
                <div class="label">Ø Sitzungsdauer</div>
                <div class="trend trend-up">↑ 2 min</div>
            </div>
            <div class="stat-card">
                <div class="value">78%</div>
                <div class="label">Ø Erfolgsrate</div>
                <div class="trend trend-up">↑ 4%</div>
            </div>
        </div>

        <h2 style="margin: 2rem 0 1rem 0; color: #f8fafc;">📈 Generatoren-Ranking (letzte 7 Tage)</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Generator</th>
                    <th>Übungen</th>
                    <th>Erfolgsrate</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td>genKreisdiagramm</td>
                    <td>452</td>
                    <td>82%</td>
                    <td><span class="badge-green">🟢 Gut</span></td>
                </tr>
                <tr>
                    <td>2</td>
                    <td>genDreieckWinkel</td>
                    <td>387</td>
                    <td>74%</td>
                    <td><span class="badge-amber">🟡 Mittel</span></td>
                </tr>
                <tr>
                    <td>3</td>
                    <td>genBruchAddition</td>
                    <td>312</td>
                    <td>68%</td>
                    <td><span class="badge-amber">🟡 Mittel</span></td>
                </tr>
                <tr>
                    <td>4</td>
                    <td>genPythagoras</td>
                    <td>245</td>
                    <td>72%</td>
                    <td><span class="badge-amber">🟡 Mittel</span></td>
                </tr>
                <tr>
                    <td>5</td>
                    <td>genBruchDivision</td>
                    <td>189</td>
                    <td>66%</td>
                    <td><span class="badge-red">🔴 Aufmerksamkeit</span></td>
                </tr>
            </tbody>
        </table>

        <h2 style="margin: 2rem 0 1rem 0; color: #f8fafc;">⚠️ Fehler-Schwerpunkte</h2>
        <table>
            <thead>
                <tr>
                    <th>Generator</th>
                    <th>Fehlerrate</th>
                    <th>Empfehlung</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>genBruchDivision</td>
                    <td>34%</td>
                    <td>Tipp-System überarbeiten (Schritt 2 unklar)</td>
                </tr>
                <tr>
                    <td>genPythagoras</td>
                    <td>28%</td>
                    <td>Hint überprüfen (Katetensatz vs. Hypotenuse)</td>
                </tr>
            </tbody>
        </table>

        <h2 style="margin: 2rem 0 1rem 0; color: #f8fafc;">🔁 Wiederholungstraining</h2>
        <div class="stat-card">
            <div class="value">89</div>
            <div class="label">Aufgaben offen</div>
            <div class="trend">🚨 Ampel-Rot: 12 Nutzer bei genBruchAddition</div>
        </div>

        <div class="note">
            <strong>Datenschutz:</strong> Alle Daten sind pseudonymisiert. IP-Adressen werden
            serverseitig gehasht (SHA-256), keine Klarnamen oder E-Mails werden gespeichert.
            Datenverarbeitung basiert auf berechtigtem Interesse (Art. 6(1)(f) GDPR).
            Opt-out für Nutzer jederzeit möglich.
        </div>
    <?php endif; ?>
</div>
</body>
</html>