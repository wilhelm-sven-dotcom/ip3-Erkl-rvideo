# Sprecheraufnahme mit ElevenLabs

Ziel: 32 Einzeldateien, eine je Satz, die die synthetische Layout-Stimme ersetzen.

## Einstellungen

- Tarif: kostenpflichtig (ab Starter), sonst keine kommerzielle Nutzung erlaubt.
- Stimme: deutscher Muttersprachler, ruhig und sachlich, z. B. aus der Voice Library mit Filter Sprache Deutsch, Kategorie Narration oder Business.
- Modell: Multilingual v2 (stabiler als v3 Alpha für Werbung).
- Stabilität ca. 50 %, Ähnlichkeit ca. 75 %, Stil 0 %, Geschwindigkeit 0,95 bis 1,0.
- Ausgabeformat: WAV 48 kHz, falls im Tarif verfügbar, sonst MP3 mit höchster Bitrate.
- Aussprache: „Redispatch“ bei Bedarf als „Ri-dis-pätsch“ schreiben, „Dashboard“ als „Däschbord“.

## Sätze und Dateinamen

Die Länge ist die der Layout-Stimme; bis etwa 20 % länger ist unkritisch.

| Datei | Länge Layout | Text |
|---|---|---|
| L01.wav | 0.8 s | Die Sonne scheint. |
| L02.wav | 1.4 s | Trotzdem sinkt die Leistung. |
| L03.wav | 1.4 s | Wer regelt Ihren Solarpark? |
| L04.wav | 1.2 s | Und was kostet Sie das? |
| L05.wav | 2.2 s | Die Antwort steckt in Ihren Betriebsdaten. |
| L06.wav | 2.2 s | Wir installieren einen Rechner im Solarpark. |
| L07.wav | 4.6 s | Er liest Steuerung, Fernwirktechnik, Datenlogger und Einstrahlungssensor aus. |
| L08.wav | 2.5 s | Unsere Software bündelt alles in einem Dashboard. |
| L09.wav | 1.8 s | So sehen Sie, wer eingreift. |
| L10.wav | 1.7 s | Hier regelt der Direktvermarkter ab. |
| L11.wav | 2.6 s | Dort der Netzbetreiber, im Rahmen von Redispatch. |
| L12.wav | 3.1 s | Wir verknüpfen jede Vorgabe mit der tatsächlichen Leistung. |
| L13.wav | 1.9 s | So wird die Ursache nachvollziehbar. |
| L14.wav | 2.0 s | Doch was hätte Ihre Anlage erzeugen können? |
| L15.wav | 2.9 s | Ein Sensor im Park misst, wie viel Sonne ankommt. |
| L16.wav | 3.9 s | Mit den Anlagendaten berechnen wir die mögliche Leistung ohne Abregelung. |
| L17.wav | 3.1 s | Die Fläche zwischen beiden Kurven ist die entgangene Energie. |
| L18.wav | 2.2 s | Diese Werte gleichen wir mit Ihren Abrechnungen ab. |
| L19a.wav | 1.0 s | Direktvermarktung. |
| L19b.wav | 0.8 s | Marktprämie. |
| L19c.wav | 1.0 s | Ausfallenergie. |
| L20.wav | 1.5 s | Abweichungen werden sichtbar. |
| L21.wav | 3.8 s | Und Sie haben die Nachweise, um mögliche Ausgleichsansprüche zu prüfen. |
| L22.wav | 3.0 s | Auf Wunsch übernehmen wir auch die technische Betriebsführung. |
| L23.wav | 1.7 s | Und wir beraten Sie persönlich. |
| L24.wav | 2.0 s | Passt Ihre Direktvermarktung zur Anlage? |
| L25.wav | 1.6 s | Gibt es Verbesserungspotenzial? |
| L26.wav | 2.2 s | Könnte sich ein zusätzlicher Speicher rechnen? |
| L27.wav | 1.5 s | Das prüfen wir individuell. |
| L28.wav | 2.2 s | Verstehen, was Ihre Anlage leistet. |
| L29.wav | 1.4 s | Erkennen, was in ihr steckt. |
| L30.wav | 2.5 s | Lassen Sie uns Ihren Solarpark genauer ansehen. |

## Übergabe

Dateien genau so benennen und in den Chat hochladen oder nach `audio/vo_neu/` legen. Danach werden Mischung, Untertitel-Zeiten und Video neu erzeugt; das Bild bleibt gleich.
