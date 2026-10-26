-- ============================================================
-- Analytics-Tabellen (P9: Lern-Analytics mit Dashboard)
-- Ergänzung zu bestehenden Tabellen (klassen, users, progress, sessions)
-- ============================================================

-- Pseudonyme Nutzer-Identität für Analytics
CREATE TABLE IF NOT EXISTS analytics_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    consent_analytics BOOLEAN DEFAULT FALSE,
    consent_cookies BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sitzungen für Analytics (pseudonym, IP gehasht)
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id CHAR(64) PRIMARY KEY,
    analytics_user_id INT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NULL,
    ended_at DATETIME NULL,
    duration_ms INT NULL,
    device_type VARCHAR(20),
    browser VARCHAR(50),
    country CHAR(2),
    current_generator VARCHAR(50) NULL,
    ip_hash CHAR(64),
    FOREIGN KEY (analytics_user_id) REFERENCES analytics_users(id) ON DELETE SET NULL,
    INDEX idx_analytics_user (analytics_user_id),
    INDEX idx_started (started_at),
    INDEX idx_last_seen (last_seen),
    INDEX idx_current_generator (current_generator)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migration für bestehende DBs (manuell in phpMyAdmin ausführen):
-- ALTER TABLE analytics_sessions ADD COLUMN last_seen DATETIME NULL AFTER started_at;
-- ALTER TABLE analytics_sessions ADD COLUMN current_generator VARCHAR(50) NULL AFTER country;
-- ALTER TABLE analytics_sessions ADD INDEX idx_last_seen (last_seen);
-- ALTER TABLE analytics_sessions ADD INDEX idx_current_generator (current_generator);

-- Events: alle Nutzer-Interaktionen
CREATE TABLE IF NOT EXISTS analytics_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id CHAR(64) NULL,
    analytics_user_id INT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSON NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_ms INT NULL,
    FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (analytics_user_id) REFERENCES analytics_users(id) ON DELETE SET NULL,
    INDEX idx_session (session_id),
    INDEX idx_analytics_user (analytics_user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ergebnis-Tabelle für Übungen
CREATE TABLE IF NOT EXISTS analytics_exercise_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NULL,
    generator_id VARCHAR(50) NOT NULL,
    difficulty TINYINT NOT NULL,
    correct BOOLEAN NOT NULL,
    answer_duration_ms INT NULL,
    hint_shown BOOLEAN DEFAULT FALSE,
    ampere_before VARCHAR(10),
    ampere_after VARCHAR(10),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES analytics_events(id) ON DELETE SET NULL,
    INDEX idx_generator (generator_id),
    INDEX idx_difficulty (difficulty),
    INDEX idx_correct (correct),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;