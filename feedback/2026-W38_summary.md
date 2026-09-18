# 📊 Wochen-Feedback-Bericht 2026-W38

Erstellt: 2026-09-18T16:41:31.818427 | Feedback-Issues: 2

## Hauptthemen
- Falsche Tippzuordnung: Kreisumfang-Aufgabe enthält Tipps für Rechtecke.
- Unklare Aufgabenformulierung: Begriff „Radi" im Säulendiagramm-Kontext ist nicht verständlich.
- Inkonsistente Fachbegriffe: Aufgabe, Diagramm und Tipp verwenden unterschiedliche oder fehlerhafte Begriffe.
- Fehlende Qualitätssicherung: Es gibt keine automatische Prüfung auf Aufgaben-Tipp-Konsistenz.

## Priorisierte Verbesserungen
1. [Content-Qualität] Kreisumfang-Aufgabe mit korrekten Kreisumfang-Tipps statt Rechteck-Tipps versehen | Aufwand XS
2. [Text-Qualität] Begriff „Radi" in der Diagrammaufgabe in den korrekten, eindeutigen Begriff ändern | Aufwand XS
3. [Validierung] Automatische Prüfung von Aufgabe, Diagramm-Element und Tipp vor Veröffentlichung einbauen | Aufwand M
4. [UX] Autoren-Warnung bei unterschiedlichen Geometrie-/Diagrammbegriffen in Aufgabe und Tipp anzeigen | Aufwand S

## 🤖 Entwicklungsprompt
Verbessere die Mathe-Lern-App wie folgt:
1. Füge eine Validierung hinzu, die bei Aufgabe „Berechne den Umfang dieses Kreises (Radius gegeben)" verhindert, dass Rechteck-Tipps zugeordnet werden, und weise stattdessen Kreisumfang-Tipps zu.
2. Prüfe die Aufgabe „Wie viel steht über Radi?" auf die korrekte Bezeichnung des Diagramm-Elements und ersetze „Radi" durch den im Diagramm und Datenmodell verwendeten Begriff.
3. Füge eine globale Konsistenzprüfung zwischen Aufgaben-Titel, Aufgaben-Text, Diagramm-Elementen und Tipp-Text hinzu.
4. Zeige Autoren eine Warnung an, wenn Geometrie-/Diagrammbegriffe in Aufgabe
