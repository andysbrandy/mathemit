# SETUP & TESTING – NICHT COMMITTEN!

Diese Datei enthält nur lokale Hinweise für das Deployment. **Nicht in das Repository committen.**

## Architektur (wichtig!)

| Subdomain | Wofür | Wie ausgeliefert |
|-----------|-------|------------------|
| `mathemit.andybrandy.at` | Frontend (Lern-App) | GitHub Pages, direkt aus git-Repo (`index.html`, `app-active.js`, `app-base.js`, etc.) |
| `mapi.andybrandy.at` | Backend (API) | Direkt auf Server, PHP-Dateien per FTP/SFTP hochgeladen |

## Dateien, die auf welchen Server müssen

### GitHub Pages (`mathemit.andybrandy.at`)
Diese Dateien landen im git-Repo und werden von GitHub Pages ausgeliefert:
- `index.html` (enthält Consent-Banner HTML/CSS)
- `app-active.js` (enthält Heartbeat + Consent-Logik)
- `app-base.js`

### Backend-Server (`mapi.andybrandy.at`)
Diese PHP-Dateien per FTP/SFTP hochladen, CHMOD 644:
- `backend/_m_staff_2025_x7k9.php` → `https://mapi.andybrandy.at/_m_staff_2025_x7k9.php`
- `backend/staff_stats.php` → `https://mapi.andybrandy.at/staff_stats.php`
- `backend/analytics_heartbeat.php` → `https://mapi.andybrandy.at/analytics_heartbeat.php`

## DB-Migration (einmalig in phpMyAdmin)

```sql
ALTER TABLE analytics_sessions ADD COLUMN last_seen DATETIME NULL AFTER started_at;
ALTER TABLE analytics_sessions ADD COLUMN current_generator VARCHAR(50) NULL AFTER country;
ALTER TABLE analytics_sessions ADD INDEX idx_last_seen (last_seen);
ALTER TABLE analytics_sessions ADD INDEX idx_current_generator (current_generator);
```

## Test-Checkliste

1. **Frontend neu laden** (nach git-push): GitHub Pages braucht bis zu 1 Minute zum Deployen
2. **Hard Reload**: `Cmd+Shift+R` (PWA-Cache umgehen)
3. **Banner testen**: Konsole öffnen → `localStorage.removeItem('mathemit_analytics_enabled')` → Seite neu laden → Banner sollte unten erscheinen
4. **Heartbeat testen**: "Ja, aktivieren" klicken → Übung starten → nach ~30s Dashboard prüfen
5. **Dashboard**: `https://mapi.andybrandy.at/_m_staff_2025_x7k9.php` → echte Zahlen statt "-"

## Bekannte Fallstricke

- PWA service worker cachet aggressiv → bei Änderungen immer Hard Reload oder Service Worker unregisteren
- `index.html` wird von GitHub Pages ausgeliefert, nicht lokal getestet
- Alle API-Calls im Frontend gehen an `mapi.andybrandy.at` (CORS muss dort passen – ist bereits in `cors.php` konfiguriert)

## Architektur: IIFE-Scope in `app-active.js` (wichtig für Änderungen!)

`app-active.js` nutzt mehrere **IIFEs** (Immediately Invoked Function Expressions), jeder mit **eigenem Scope**:

| IIFE | Zeilen | Was darin definiert | Sichtbar außerhalb? |
|------|--------|---------------------|---------------------|
| Analytics-IIFE | ~56–170 | `getConsentState()`, `isAnalyticsEnabled()`, `sendEvent()`, `enable()`, `disable()` | Nur über `window.__mbAnalytics` |
| Banner-UI-IIFE | ~201–260 | `showBanner()`, `updateOptOutButton()`, Click-Handler für Banner/Toggle | **Nein** – separater Scope |

### ⚠️ Wichtig bei Änderungen am Consent-Banner

Wenn du im Banner-IIFE auf `getConsentState()` oder `isAnalyticsEnabled()` zugreifst, musst du **immer** über `window.__mbAnalytics` gehen:

```javascript
// ✅ Richtig:
var consent = window.__mbAnalytics.getConsentState();
var enabled = window.__mbAnalytics.isEnabled();

// ❌ Falsch (führt zu ReferenceError, weil nicht im Scope):
var consent = getConsentState();
var enabled = isAnalyticsEnabled();
```

Der Bug (v243): `showBanner()` stürzte bei `getConsentState()` ab, bevor `banner.style.display = 'block'` ausgeführt wurde. Deshalb blieb der Banner für immer versteckt. Fix in v244: alle Aufrufe über `window.__mbAnalytics`.