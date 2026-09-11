# 🔒 Datenschutz-Checkliste (Art 30 DSGVO, vereinfacht)

> Privatprojekt, nicht-kommerziell. Stand: v53. Grundlage: DSB.gv.at, ECG §5, TKG 2021 §165, Art 8 DSGVO.

## Verzeichnis der Verarbeitungstätigkeiten

| # | Tätigkeit | Kategorien Daten | Betroffene | Rechtsgrundlage | Aufbewahrung | Empfänger |
|---|-----------|------------------|------------|-----------------|--------------|-----------|
| 1 | Login/Registrierung | Nickname, PIN (bcrypt-Hash) | Schüler:innen | Art 6(1)(b) | bis Kontolöschung | — |
| 2 | Fortschrittsspeicherung | Punkte, Streaks, Badges, Modus | registrierte Nutzer | Art 6(1)(b) | bis Kontolöschung | — |
| 3 | Brute-Force-Schutz | IP, Endpoint, Zeitstempel | alle Besucher | Art 6(1)(f) | 30 Tage (cleanup.php) | — |
| 4 | Feedback (optional) | Feedbacktext, Übungsdaten, Timestamp | freiwillige Nutzer | Art 6(1)(a) Einwilligung (Button) | bis Löschen des Issues | GitHub Inc. (USA) |
| 5 | localStorage (Browser) | Spielstand | Nutzer | techn. notwendig, § 165 TKG 2021 | bis Browser-Datenlöschung | — |

## TOMs (Art 32) — umgesetzt

- ✅ PIN bcrypt (cost 12)
- ✅ HTTPS erzwungen (.htaccess, HSTS)
- ✅ Sessions: 64-Zeichen-Hex-Token mit Ablaufdatum
- ✅ Rate-Limiting (3 Register/h, 5 Login/15 Min)
- ✅ Server in Österreich (World4You, Linz)
- ✅ Kontolöschung möglich (delete_account.php)

## Art 8 DSGVO (Kinder) — umgesetzt

- ✅ Registrierungs-Checkbox „14+ oder Eltern erlaubt"
- ✅ Serverseitige Pflichtprüfung (register.php → 400 ohne consent)
- ✅ `consent_at`-Timestamp als Nachweis (users-Tabelle)
- ⚠️ **Migration auf Live-DB nötig:** `ALTER TABLE users ADD COLUMN consent_at DATETIME NULL AFTER pin_hash;`

## ✅ Deine persönlichen To-Dos

| # | To-do | Warum | Erledigt |
|---|-------|-------|----------|
| 1 | Platzhalter in `impressum.html`, `datenschutz.html`, `agb.html` ersetzen (Name, Anschrift, E-Mail) | Transparenz, ECG best practice | ☐ |
| 2 | `ALTER TABLE users ADD COLUMN consent_at DATETIME NULL` in phpMyAdmin ausführen + neue `register.php` auf mapi-Server hochladen | Art-8-Nachweis funktioniert | ☐ |
| 3 | AVV/Versicherungsbestätigung mit World4You prüfen (deren Website → Verträge; i. d. R. AVV-Template) | Art 28 | ☐ |
| 4 | Feedback-Issue #1 im GitHub-Repo prüfen → enthält dein Test-Feedback mit Übungsdaten; ggf. schließen/löschen | Datenminimierung | ☐ |
| 5 | (Optional, maximale Risikominimierung) GitHub-Repo auf **private** stellen — Feedback-Issues wären dann nicht öffentlich. Trade-off: Code ist dann auch nicht öffentlich. KI-Workflows funktionieren weiter (2000 Gratis-Minuten/Monat reichen locker). | Kinder-Daten im öffentlichen Repo | ☐ |

## Risikobewertung (Privatprojekt, nicht-kommerziell)

- **Keine Impressumspflicht** (ECG §5 erfordert unternehmerisches Handeln) — Impressum trotzdem freiwillig angelegt
- **Keine AGB-Pflicht** — Nutzungsbedingungen trotzdem angelegt (Minderjährigen-Klausel = wichtigster Schutz)
- **Kein Consent-Banner nötig** — nur technisch notwendiger Speicherzugriff (§ 165 TKG 2021)
- **Kein Datenschutzbeauftragter nötig** (Art 37: Kernbereichsverarbeitung liegt nicht vor)
- **Höchstes Restrisiko:** öffentliche Feedback-Issues (Kinder-Daten) → durch Modal-Warnung gemildert; Endlösung: Option 5
