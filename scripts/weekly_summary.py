import os, json, requests, datetime, glob, re, sys

GH_TOKEN = os.getenv('GH_TOKEN')
HF_TOKEN = os.getenv('HF_API_TOKEN')
REPO = os.getenv('GITHUB_REPOSITORY')  # z. B. "andysbrandy/mathemit"

def gh_get(url):
    r = requests.get(url, headers={'Authorization': f'token {GH_TOKEN}', 'Accept': 'application/vnd.github+json'})
    r.raise_for_status()
    return r.json()

def hf_query(prompt):
    # flan-t5-base ist im Serverless-Tier nicht mehr verfuegbar (400).
    # Robust: Chat-Completions-Route des HF-Routers mit kleinem kostenlosem Modell.
    API_URL = "https://router.huggingface.co/v1/chat/completions"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    response = requests.post(API_URL, headers=headers, json={
        "model": "meta-llama/Llama-3.2-3B-Instruct",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 400
    }, timeout=60)
    if not response.ok:
        # Diagnose: Antwort-Body ausgeben, damit der Workflow-Log die Ursache zeigt
        print("HF-Fehler", response.status_code, ":", response.text[:500])
        response.raise_for_status()
    return response.json()['choices'][0]['message']['content']

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