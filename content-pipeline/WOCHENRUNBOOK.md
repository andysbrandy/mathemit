# 🗓️ Wochen-Runbook — regelmäßig Content posten (7.5)

**Wofür:** Ein Clip pro Woche auf YouTube Shorts, TikTok und Instagram Reels.
Alles außer dem eigentlichen Hochladen macht **ein Befehl**. Hochgeladen wird
weiterhin von Hand — das ist Absicht, siehe [Warum manuell](#warum-manuell).

**Dauer:** ~5 Minuten für dich, Rest ist Wartezeit beim Rendern.

---

## Einmalig: Mail einrichten (nur beim ersten Mal)

Damit nach dem Rendern eine Mail mit dem Freigabe-Link ankommt, braucht es
einen Resend-Schlüssel. Er liegt als GitHub-Secret vor, aber **lokal ist er
nicht gesetzt** — ohne ihn läuft der Lauf trotzdem durch, nur ohne Mail.

```bash
cd content-pipeline
echo -n 're_XXXXXXXXXXXXXXXX' > .mail-key
```

Empfänger ist `andybrandy@gmx.at`. Die Datei `.mail-key` steht in `.gitignore`
und wird nie eingecheckt. Es geht auch `MAIL_TO=... npm run woche` für ein
anderes Ziel.

> Kommt `403` zurück, ist meist der Absender nicht freigegeben — dann in
> resend.com eine Domain bestätigen oder `onboarding@resend.dev` gegen die
> eigene Adresse tauschen.

---

## Pro Woche

### 1. Rendern starten

```bash
cd content-pipeline
npm run woche
```

Das Skript erledigt in einem Durchgang:

| Schritt | Was passiert |
|---|---|
| Hook wählen | aus der Wochenrotation (siehe unten), überschreibbar mit `--hook` |
| Auswahl | 3 Aufgaben, Seed aus der Kalenderwoche — **deterministisch**, gleiche Woche = gleicher Clip |
| Rendern | 540 Frames, ~2–3 Min. Bei `vorher-nachher` und `countdown` etwas länger |
| Queue | Clip, Caption, Hashtags und Manifest landen in `work/queue/` |
| Freigabe-Server | startet auf Port 8787 |
| Mail | geht an dich raus mit Link, Caption, Hashtags und MP4-Pfad |

Ist schon alles bereit und du willst nur schauen, was passieren würde:

```bash
npm run woche:dry          # rendert nichts, startet nichts
```

### 2. Freigeben

Die Mail enthält den Link. Der Server läuft **so lange das Terminal offen
ist** — `Ctrl+C` beendet ihn.

Für eine andere Aufgabe aus der Auswahl: `npm run woche -- --index 1`
(0, 1 oder 2).

### 3. Hochladen (manuell)

In der Mail steht der Pfad zur MP4. Hochladen auf:

1. **YouTube Shorts**
2. **TikTok**
3. **Instagram Reels**

Caption und Hashtags stehen direkt in der Mail zum Kopieren.

### 4. Messen (nicht überspringen)

Nach **24 Stunden** in [`MESSPROTOKOLL.md`](MESSPROTOKOLL.md) eine Zeile
anlegen: Datum, Hook, Kanal, Reichweite, Retention. Ohne diese Zahlen weiß
nach drei Wochen niemand, welcher Hook funktioniert — und die Hook-Bibliothek
existiert genau dafür.

---

## Hook-Rotation

Feste Reihenfolge über alle fünf Vorlagen, gesteuert von der Kalenderwoche.
So wird jede Vorlage wirklich benutzt, statt dass `frage` gewinnt, weil es
der Standard ist.

| Kalenderwoche | Hook |
|---|---|
| KW 40 | `countdown` |
| KW 41 | `vorher-nachher` |
| KW 42 | `frage` |
| KW 43 | `streak` |
| KW 44 | `erwachsenen` |
| KW 45 | `countdown` … |

Anderswo in der Woche gezielt posten:

```bash
npm run woche -- --hook streak
```

---

## Wenn etwas klemmt

| Symptom | Ursache und Abhilfe |
|---|---|
| `FEHLER: Unbekannte Hook-Vorlage` | Tippfehler. Erlaubt: `frage, countdown, erwachsenen, streak, vorher-nachher` |
| `⚠️ KEINE MAIL GESENDET` | `.mail-key` fehlt. Der Freigabe-Link steht trotzdem im Terminal |
| Server antwortet nicht | Port 8787 belegt → `npm run woche -- --port 8899` |
| Clip sieht veraltet aus | Queue aus alten Läufen. `npm run woche` rendert neu; `npm run review` zeigt den alten Stand |
| Rendern bricht ab | Chrome fehlt → `CHROME_PATH` setzen, siehe `content-pipeline/README.md` |

Alle Testblöcke, wenn hier etwas kaputtgeht:

```bash
npm run test:changed     # rechnet aus den geänderten Dateien, was zu prüfen ist
```

---

## Warum manuell

Zwei Gründe, beide bewusst:

1. **Freigabe bleibt zwingend.** Kein automatischer Weg von „Clip fertig" zu
   „Post ist live". Der Freigabeklick ist der Schritt, bei dem man den Clip
   wirklich ansieht.
2. **7.4.5 (`publish-episode.js`) bleibt offen.** Die Roadmap hat dafür eine
   eigene Abbruchregel: steht ein API-Zugang nicht, wird **nicht** ersetzt,
   sondern läuft 7.5 manuell weiter. Automatisierung wäre Komfort, nicht
   Engpass.

---

## Was diese Woche offen ist

Die Queue sammelt über die Zeit alte Episoden. Nach dem Posten nicht
vergessen, verbrauchte Einträge zu markieren oder zu löschen — sonst wird
`work/queue/` unübersichtlich und man postet versehentlich zweimal.