import os, json, requests, datetime, re, sys
from tqdm import tqdm

GH_TOKEN = os.getenv('GH_TOKEN')
HF_TOKEN = os.getenv('HF_API_TOKEN')
REPO = os.getenv('GITHUB_REPOSITORY')  # z. B. "andybrandy/mathemit"

def gh_get(url):
    r = requests.get(url, headers={'Authorization': f'token {GH_TOKEN}', 'Accept': 'application/vnd.github+json'})
    r.raise_for_status()
    return r.json()

def gh_post(url, data):
    r = requests.post(url, headers={'Authorization': f'token {GH_TOKEN}', 'Accept': 'application/vnd.github+json'}, json=data)
    r.raise_for_status()
    return r.json()

def hf_query(payload):
    # flan-t5-base ist im Serverless-Tier nicht mehr verfuegbar (400).
    # Robust: Chat-Completions-Route des HF-Routers mit kleinem kostenlosem Modell.
    API_URL = "https://router.huggingface.co/v1/chat/completions"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    user_content = payload.get('inputs', '') if isinstance(payload, dict) else str(payload)
    response = requests.post(API_URL, headers=headers, json={
        "model": "meta-llama/Llama-3.2-3B-Instruct",
        "messages": [{"role": "user", "content": user_content}],
        "max_tokens": 300
    }, timeout=60)
    if not response.ok:
        print("HF-Fehler", response.status_code, ":", response.text[:500])
        response.raise_for_status()
    return response.json()['choices'][0]['message']['content']

def prioritize_suggestions(raw_suggestions):
    """Filtere & priorisiere die KI-Ausgaben:
    - Entfere Duplikate (behält zuerst)
    - Sortiere nach Schlüsselwörtern (Wichtig > Nice-to-have)
    - Weisse nur gültige Format-Zeilen
    """
    valid = []
    seen = set()
    for s in raw_suggestions:
        if not s or s in seen:
            continue
        # Nur Zeilen akzeptieren, die #xxx enthalten
        if '#' not in s:
            continue
        seen.add(s)
        valid.append(s)
    # Einfache Priorisierung: Zeilen mit "Wichtig", "Kritisch", "Bug" nach oben ziehen
    keywords = ['Wichtig', 'Kritisch', 'Bug', 'Fehler', 'Performance']
    ranked = []
    for kw in keywords:
        for s in valid:
            if kw.lower() in s.lower() and s not in ranked:
                ranked.append(s)
    for s in valid:
        if s not in ranked:
            ranked.append(s)
    return ranked[:9]  # max 9 Vorschläge

def main():
    # 1. Feedback-Issues vom Vortag holen
    # Hinweis: Kein Label-Filter im API-Call - GitHub verwirft unbekannte Labels
    # stillschweigend beim Issue-Erstellen, daher filtern wir clientseitig.
    yesterday = (datetime.datetime.now() - datetime.timedelta(days=1)).date().isoformat()
    all_issues = gh_get(f'https://api.github.com/repos/{REPO}/issues?state=all&since={yesterday}T00:00:00Z')
    issues = [i for i in all_issues
              if any(l['name'] == 'feedback' for l in i.get('labels', []))
              or i['title'].lower().startswith('feedback')]
    if not issues:
        print("Keine neuen Feedback-Issues.")
        return

    raw_suggestions = []
    for issue in tqdm(issues, desc="Verarbeite Issues"):
        try:
            payload = json.loads(issue['body'])
            exercise = payload.get('exercise', {})
            feedback_text = payload.get('feedback', '')
            # Prompt für das HF-Modell
            prompt = f"""Du bist ein pädagogischer Assistent für eine Mathe-Lernapp.
            Extrahiere daraus genau drei konkrete, umsetzbare Verbesserungsvorschläge für die App oder die Aufgabenstellung.
            Jeder Vorschlag soll im Format sein:
            #[Kategorie] Vorschlag | Begründung | Aufwand (XS/S/M/L)
            kategorien können sein: Aufgabenstellung, Hint-System, Schwierigkeitsstufen, UI/Feedback, Erklärung, etc.
            Gib nur die drei Zeilen aus, nichts anderes.

            Aufgabentext (falls vorhanden):
            {json.dumps(exercise, ensure_ascii=False, indent=2)}

            Nutzer-Feedback:
            {feedback_text}
            """
            out = hf_query({"inputs": prompt, "parameters": {"max_new_tokens": 200}})
            # Extrahiere Zeilen, die mit # beginnen
            for line in out.split('\n'):
                line = line.strip()
                if line.startswith('#'):
                    raw_suggestions.append(line)
        except Exception as e:
            print(f"Fehler bei Issue {issue['number']}: {e}")

    # Priorisierung & Deduplizierung
    suggestions = prioritize_suggestions(raw_suggestions)

    if not suggestions:
        print("Keine Vorschläge erzeugt.")
        return

    # 2. Analyse‑Datei schreiben
    out_dir = 'feedback'
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, f"{datetime.date.today().isoformat()}_analysis.md")
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write(f"# Feedback‑Analyse {datetime.date.today().isoformat()}\n\n")
        f.write("\n".join(suggestions) + "\n")
    print(f"Analyse geschrieben nach {out_file}")

if __name__ == '__main__':
    main()