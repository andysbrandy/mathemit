-- backend/schema.sql
-- Hinweis: Dieses File dient ausschließlich als Vorlage/Dokumentation.
-- Es wird *nicht* automatisch beim Deploy ausgeführt.
-- Führe die Statements manuell in phpMyAdmin (World4You) aus.

CREATE TABLE IF NOT EXISTS klassen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(12) UNIQUE NOT NULL,
    lehrer_email VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    klasse_id INT NULL,
    nickname VARCHAR(50) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_nick_per_klasse (klasse_id, nickname),
    FOREIGN KEY (klasse_id) REFERENCES klassen(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS progress (
    user_id INT PRIMARY KEY,
    points INT DEFAULT 0,
    streak INT DEFAULT 0,
    best_streak INT DEFAULT 0,
    solved INT DEFAULT 0,
    correct INT DEFAULT 0,
    badges JSON,
    mode VARCHAR(50),
    grade VARCHAR(10),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
    token CHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    INDEX idx_user (user_id),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabelle für Rate-Limiting und Brute-Force-Schutz.
-- Jeder fehlgeschlagene Login/Register/Delete-Versuch wird hier geloggt.
-- cleanup.php löscht Einträge älter als 30 Tage (DSGVO).
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    endpoint VARCHAR(50) NOT NULL,
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip_endpoint_time (ip, endpoint, attempted_at),
    INDEX idx_time (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;