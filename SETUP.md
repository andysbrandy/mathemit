# 🏗️ Mathemit – Setup & Architektur

> Diese Datei dokumentiert die technische Architektur und alle Backend-Konfigurationen.
> Sie sollte bei jedem neuen Chat/Prompt als Kontext mitgeliefert werden.

---

## 🌐 Backend-Infrastruktur

| Komponente | URL | Zweck |
|------------|-----|-------|
| **Frontend (GitHub Pages)** | `https://mathemit.andybrandy.at/` | Statische Web-App (HTML, JS, CSS) |
| **Backend (World4You)** | `https://mapi.andybrandy.at/` | PHP-API für Login, Progress, Analytics |

### Wichtig: Backend-Subdomain

Alle API-Requests gehen an **`https://mapi.andybrandy.at/`** (NICHT an `mathemit.andybrandy.at/backend/`).

Die PHP-Dateien liegen physisch unter `mapi.andybrandy.at/` (Wurzelverzeichnis der Subdomain), also z. B.:
- `https://mapi.andybrandy.at/analytics.php`
- `https://mapi.andybrandy.at/analytics_heartbeat.php`
- `https://mapi.andybrandy.at/progress.php`
- `https://mapi.andybrandy.at/login.php`
- `https://mapi.andybrandy.at/register.php`
- `https://mapi.andybrandy.at/ping.php`

---

## 📡 API-Endpunkte

| Endpunkt | Methode | Auth | Zweck |
|----------|---------|------|-------|
| `/analytics.php` | POST | Token | Lern-Events senden (Sessions, Klicks, Übungen, Fehler) |
| `/analytics_heartbeat.php` | POST | Token | Heartbeat für Live-Dashboard (alle 30s) |
| `/progress.php` | GET/POST | Token | Fortschritt laden/speichern (Punkte, Eulen, Streaks) |
| `/login.php` | POST | Nein | Nutzer-Login (Nickname + PIN) |
| `/register.php` | POST | Nein | Nutzer-Registrierung |
| `/ping.php` | GET | Nein | Server-Erreichbarkeit prüfen |

---

## 🔐 Consent & Analytics

| Key | Werte | Bedeutung |
|-----|-------|-----------|
| `mathemit_consent_v1` | `'granted'` \| `'denied'` \| `null` | Analytics-Consent (Banner in index.html) |
| `mathemit_analytics_enabled` | veraltet | Wurde durch `mathemit_consent_v1` ersetzt |

### Consent-Flow
1. Nutzer öffnet App → Consent-Banner erscheint (wenn Key `null`)
2. Nutzer klickt "Ja" → Key wird auf `'granted'` gesetzt → `window.__mbAnalytics.enable()` wird aufgerufen
3. Nutzer klickt "Nein" → Key wird auf `'denied'` gesetzt → `window.__mbAnalytics.disable()` wird aufgerufen
4. Nutzer klickt Footer-Toggle → Key wird umgeschaltet

Ohne Consent (`null` oder `'denied'`) werden **keine** Analytics-Events gesendet.

---

## 📊 Progress-Sync (Fortschritt)

Der Lernfortschritt wird an zwei Stellen gespeichert:

| Speicherort | Zweck | Vorteil |
|-------------|-------|---------|
| **localStorage** (`formenwerkstatt_progress_v1`) | Offline-Cache | Sofort verfügbar, auch ohne Netz |
| **Backend-DB** (`progress` Tabelle) | Permanente Speicherung | Überlebt Gerätewechsel, Browser-Cache-Leerung |

### Sync-Ablauf
1. **Login** → `loadProgressFromAPI()` lädt Fortschritt von DB und überschreibt localStorage
2. **Während des Trainings** → `saveProgress()` schreibt in localStorage **und** sendet an `/progress.php` (wenn online)
3. **Bei Netzwerkfehler** → Fortschritt landet in lokaler Warteschlange (`formenwerkstatt_progress_pending_v1`), wird bei Wieder-Verbindung nachgesendet
4. **Logout** → Token wird gelöscht, localStorage bleibt erhalten (für nächsten Login)

---

## 🔧 Wichtige Konfigurationen

### Frontend (`app-active.js`)
```javascript
var API = 'https://mapi.andybrandy.at';
var ANALYTICS_URL = 'https://mapi.andybrandy.at/analytics.php';
var HEARTBEAT_URL = 'https://mapi.andybrandy.at/analytics_heartbeat.php';
var CONSENT_KEY = 'mathemit_consent_v1';
var STORAGE_KEY = 'formenwerkstatt_progress_v1';
var PROGRESS_PENDING_KEY = 'formenwerkstatt_progress_pending_v1';
```

### Backend (`backend/config.php`)
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'dein_datenbank_name');
define('DB_USER', 'dein_datenbank_user');
define('DB_PASS', 'dein_datenbank_passwort');
define('ALLOWED_ORIGIN', 'https://mathemit.andybrandy.at');
```

### Backend-Dateien (auf mapi.andybrandy.at hochladen)

| Datei | Zweck | Muss auf Server? |
|-------|-------|------------------|
| `config.php` | DB-Zugangsdaten | **Ja** (nicht commiten, .gitignore) |
| `cors.php` | CORS & Security-Header | Ja |
| `analytics.php` | Event-Empfang | Ja |
| `analytics_heartbeat.php` | Heartbeat | Ja |
| `progress.php` | Fortschritt-Sync | Ja |
| `login.php` | Authentifizierung | Ja |
| `register.php` | Registrierung | Ja |
| `_m_staff_2025_x7k9.php` | Admin-Dashboard | Ja |
| `staff_stats.php` | Admin-Statistiken | Ja |

---

## 🧪 Test-Checkliste (nach Deploy)

- [ ] `https://mapi.andybrandy.at/ping.php` → 200 OK
- [ ] Login als Test-Nutzer funktioniert
- [ ] Consent-Banner erscheint bei erstem Besuch
- [ ] Analytics-Toggle im Footer funktioniert (Ein/Aus)
- [ ] Nach Login: `[mathemit] Progress vom Server geladen` in Console
- [ ] Nach Aufgabe lösen: `[mathemit] Progress an Server gesendet` in Console
- [ ] Nach Ausloggen + neuer Login: Fortschritt ist wieder da

---

## 📝 Wie bleibt dieser Kontext bei jedem Prompt erhalten?

Damit zukünftige KI-Sitzungen die Architektur kennen, gibt es drei Möglichkeiten:

1. **Diese Datei (SETUP.md) im Repository lassen** – Sie wird bei jedem `git pull` automatisch heruntergeladen und kann als Kontext mitgeliefert werden.

2. **ROADMAP.md konsultieren** – Enthält die Phasen P1–P9 mit dem aktuellen Stand (z. B. "P9.4 Admin-Dashboard abgeschlossen").

3. **Bei neuem Chat die Dateien explizit einbinden** – Wenn Sie ein neues Chat-Fenster öffnen, fügen Sie `SETUP.md` und `ROADMAP.md` als Kontext hinzu oder fügen Sie den Inhalt dieser Dateien beim ersten Prompt ein.

> **Empfohlener Workflow für neue Chats:**  
> „Hier ist der Kontext: [SETUP.md Inhalt einfügen]. Die Aufgabe lautet: …“

---

## 📞 Kontakt

- **Impressum:** https://mathemit.andybrandy.at/impressum.html
- **Datenschutz:** https://mathemit.andybrandy.at/datenschutz.html
- **AGB:** https://mathemit.andybrandy.at/agb.html