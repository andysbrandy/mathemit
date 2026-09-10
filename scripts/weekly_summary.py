import os, json, requests, datetime, glob, re, sys

GH_TOKEN = os.getenv('GH_TOKEN')
HF_TOKEN = os.getenv('HF_API_TOKEN')
REPO = os.getenv('GITHUB_REPOSITORY')  # z. B. "andysbrandy/mathemit"

def gh_get(url):
    r = requests.get(url, headers={'Authorization': f'token {GH_TOKEN}', 'Accept': 'application/vnd.github+json'})
    r.raise_for_status()
    return r.json()

def gh_models_query(prompt):
    # Primär: GitHub Models - kostenlos, Secret GH_TOKEN existiert bereits.
    API_URL = "https://models.github.ai/inference/chat/completions"
    headers = {"Authorization": f"Bearer {GH_TOKEN}"}
    response = requests.post(API_URL, headers=headers, json={
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 500
    }, timeout=90)
    if response.ok:
        print("KI via GitHub Models (openai/gpt-4o-mini)")
        return response.json()['choices'][0]['message']['content']
    print("GitHub-Models-Fehler:", response.status_code, ":", response.text[:300])
    return None

def pollinations_query(prompt):
    # Keyless-Fallback: Pollinations.ai (kostenlos, kein Account/Token noetig)
    try:
        response = requests.post(
            "https://text.pollinations.ai/openai",
            headers={"Content-Type": "application/json"},
            json={"model": "openai", "messages": [{"role": "user", "content": prompt}]},
            timeout=90
        )
        if response.ok:
            print("KI via Pollinations (keyless)")
            return response.json()['choices'][0]['message']['content']
        print("Pollinations-Fehler:", response.status_code, ":", response.text[:200])
    except Exception as e:
        print("Pollinations-Fehler:", e)
    return None

def hf_query(prompt):
    # KI-Kette: 1. GitHub Models, 2. HF (dynamische Modell-Erkennung),
    # 3. Pollinations (keyless).
    gh = gh_models_query(prompt)
    if gh:
        return gh

    # Serverless-Modelle rotieren staendig -> dynamisch abfragen, welche
    # Modelle fuer diesen Token verfuegbar sind, dann Kandidaten probieren.
    API_URL = "https://router.huggingface.co/v1"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    try:
        listing = requests.get(f"{API_URL}/models", headers=headers, timeout=30)
        available = [m.get('id', '') for m in listing.json().get('data', [])] if listing.ok else []
        print(f"HF: {len(available)} Modelle fuer Token verfuegbar")
    except Exception as e:
        available = []
        print("HF-Modell-Listing fehlgeschlagen:", e)

    # Praeferenz: kleine Instruct-Modelle sind schnell + billig
    preferred = [m for m in available if 'instruct' in m.lower() or 'smol' in m.lower() or 'qwen3' in m.lower() or 'glm' in m.lower()]
    candidates = (preferred + [m for m in available if m not in preferred])[:6]

    last_err = None
    for model in candidates:
        try:
            response = requests.post(f"{API_URL}/chat/completions", headers=headers, json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 400
            }, timeout=120)
            if response.ok:
                print("KI via HF:", model)
                return response.json()['choices'][0]['message']['content']
            last_err = f"{model} -> {response.status_code}: {response.text[:200]}"
            print("HF-Fehler:", last_err)
        except Exception as e:
            last_err = f"{model} -> {e}"
            print("HF-Fehler:", last_err)

    # Statischer Notfall-Fallback, falls das Listing leer war
    for model in ["Qwen/Qwen3-4B-Instruct-2507", "zai-org/GLM-4.5-Air"]:
        response = requests.post(f"{API_URL}/chat/completions", headers=headers, json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 400
        }, timeout=120)
        if response.ok:
            print("KI via HF (statisch):", model)
            return response.json()['choices'][0]['message']['content']
        last_err = f"{model} -> {response.status_code}: {response.text[:200]}"
        print("HF-Fehler:", last_err)

    pol = pollinations_query(prompt)
    if pol:
        return pol

    raise RuntimeError("Kein KI-Anbieter verfuegbar (GitHub Models + HF + Pollinations). "
                       "Loesung A: HF-Account -> settings/inference-providers -> Provider aktivieren. "
                       f"Letzter HF-Fehler: {last_err}")

def create_summary_issue(title, body):
    # 4. Benachrichtigungs-Issue mit Zuweisung (GitHub mailt dem Owner automatisch)
    owner = REPO.split('/')[0]
    r = requests.post(
        f'https://api.github.com/repos/{REPO}/issues',
        headers={'Authorization': f'token {GH_TOKEN}', 'Accept': 'application/vnd.github+json'},
        json={'title': title, 'body': body, 'labels': ['wochenbericht'], 'assignees': [owner]}
    )
    r.raise_for_status()
    return r.json()

def main():
    today = datetime.date.today()
    week_ago = (today - datetime.timedelta(days=7)).isoformat()
    iso_week = today.isocalendar()[1]

    # 1. Feedback-Issues der letzten 7 Tage holen (Label-ODER-Titel-Filter,
    #    da GitHub beim Issue-Erstellen ohne existierendes Label das Label still verwirft)
    issues = [i for i in gh_get(f'https://api.github.com/repos/{REPO}/issues?state=all&since={week_ago}T00:00:00Z')
              if any(l.get('name') == 'feedback' for l in i.get('labels', []))
              or i.get('title', '').lower().startswith('feedback')]
    daily_analyses = sorted(glob.glob('feedback/*_analysis.md'))

    feedback_texts = []
    for issue in issues:
        try:
            payload = json.loads(issue['body'])
            fb = payload.get('feedback', '')
            q = payload.get('exercise', {}).get('question', '')
            feedback_texts.append(f"- Aufgabe: {q[:80]} | Feedback: {fb[:200]}")
        except Exception:
            feedback_texts.append(f"- (rohes Issue) {issue.get('title','')}")

    if not feedback_texts:
        print("Keine Feedback-Issues der letzten Woche - keine Summary erzeugt.")
        return

    # 2. EIN verdichteter Prompt an die kostenlose KI
    prompt = f"""Du bist ein pädagogischer Assistent fuer eine Mathe-Lern-App. Erstelle eine Wochen-Zusammenfassung des Nutzer-Feedbacks mit EXAKT diesen vier Abschnitten:

## Hauptthemen
Drei bis fuenf haeufigste Themen/Kritikpunkte der Woche.

## Priorisierte Verbesserungen
Nummerierte Liste, sortiert nach Wichtigkeit. Format: "1. [Kategorie] Vorschlag | Aufwand (XS/S/M/L)"

## 🤖 Entwicklungsprompt
Ein fertiger, kopierbarer Entwicklungsauftrag (max. 10 Zeilen) fuer einen KI-Coding-Assistenten, der die App entsprechend verbessert. Formuliere ihn als direkte Anweisung ("Verbessere die Mathe-Lern-App wie folgt: 1. ...").

## Statistik
Anzahl Feedbacks: {len(feedback_texts)}

--- Nutzer-Feedback der Woche ---
""" + "\n".join(feedback_texts[:30])

    summary = hf_query(prompt)

    # 3. Summary-Datei schreiben
    os.makedirs('feedback', exist_ok=True)
    week_tag = f"{today.isocalendar()[0]}-W{iso_week:02d}"
    out_file = f"feedback/{week_tag}_summary.md"
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write(f"# 📊 Wochen-Feedback-Bericht {week_tag}\n\n")
        f.write(f"Erstellt: {datetime.datetime.now().isoformat()} | Feedback-Issues: {len(feedback_texts)}\n\n")
        f.write(summary + "\n")

    # 4. Benachrichtigungs-Issue (GitHub mailt dem Owner automatisch bei Zuweisung)
    issue_body = f"Automatische Wochenauswertung der Feedback-Issues.\n\nDie fertige Zusammenfassung inkl. Entwicklungsprompt liegt in `{out_file}`.\n\n---\n\n{summary[:2000]}"
    issue = create_summary_issue(f"📊 Wochenbericht {week_tag} – Entwicklungsprompt fertig", issue_body)
    print(f"Summary geschrieben: {out_file}")
    print(f"Benachrichtigungs-Issue erstellt: #{issue.get('number')}")

if __name__ == '__main__':
    main()