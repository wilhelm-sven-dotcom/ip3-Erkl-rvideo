// Erzeugt alle 32 Sprechersätze mit ElevenLabs als Einzeldateien (L01.mp3 ... L30.mp3).
// Aufruf auf dem eigenen Rechner (Node 18 oder neuer):
//   ELEVENLABS_API_KEY=dein_schluessel node elevenlabs_saetze.mjs
// Windows PowerShell:
//   $env:ELEVENLABS_API_KEY="dein_schluessel"; node elevenlabs_saetze.mjs
import fs from 'node:fs';

const VOICE_ID = 'kLhAstPcnnPxqzk6gS5i'; // Alexander - Deep TV Narrator
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('ELEVENLABS_API_KEY fehlt'); process.exit(1); }

const SAETZE = [
  ['L01', "Die Sonne scheint."],
  ['L02', "Trotzdem sinkt die Leistung."],
  ['L03', "Wer regelt Ihren Solarpark?"],
  ['L04', "Und was kostet Sie das?"],
  ['L05', "Die Antwort steckt in Ihren Betriebsdaten."],
  ['L06', "Wir installieren einen Rechner im Solarpark."],
  ['L07', "Er liest Steuerung, Fernwirktechnik, Datenlogger und Einstrahlungssensor aus."],
  ['L08', "Unsere Software bündelt alles in einem Dashboard."],
  ['L09', "So sehen Sie, wer eingreift."],
  ['L10', "Hier regelt der Direktvermarkter ab."],
  ['L11', "Dort der Netzbetreiber, im Rahmen von Ridispätsch."],
  ['L12', "Wir verknüpfen jede Vorgabe mit der tatsächlichen Leistung."],
  ['L13', "So wird die Ursache nachvollziehbar."],
  ['L14', "Doch was hätte Ihre Anlage erzeugen können?"],
  ['L15', "Ein Sensor im Park misst, wie viel Sonne ankommt."],
  ['L16', "Mit den Anlagendaten berechnen wir die mögliche Leistung ohne Abregelung."],
  ['L17', "Die Fläche zwischen beiden Kurven ist die entgangene Energie."],
  ['L18', "Diese Werte gleichen wir mit Ihren Abrechnungen ab."],
  ['L19a', "Direktvermarktung."],
  ['L19b', "Marktprämie."],
  ['L19c', "Ausfallenergie."],
  ['L20', "Abweichungen werden sichtbar."],
  ['L21', "Und Sie haben die Nachweise, um mögliche Ausgleichsansprüche zu prüfen."],
  ['L22', "Auf Wunsch übernehmen wir auch die technische Betriebsführung."],
  ['L23', "Und wir beraten Sie persönlich."],
  ['L24', "Passt Ihre Direktvermarktung zur Anlage?"],
  ['L25', "Gibt es Verbesserungspotenzial?"],
  ['L26', "Könnte sich ein zusätzlicher Speicher rechnen?"],
  ['L27', "Das prüfen wir individuell."],
  ['L28', "Verstehen, was Ihre Anlage leistet."],
  ['L29', "Erkennen, was in ihr steckt."],
  ['L30', "Lassen Sie uns Ihren Solarpark genauer ansehen."]
];

fs.mkdirSync('vo_elevenlabs', { recursive: true });
for (const [id, text] of SAETZE) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_192`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      language_code: 'de',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, speed: 0.95 },
    }),
  });
  if (!res.ok) { console.error(id, res.status, await res.text()); process.exit(1); }
  fs.writeFileSync(`vo_elevenlabs/${id}.mp3`, Buffer.from(await res.arrayBuffer()));
  console.log('ok', id);
}
console.log('Fertig: Ordner vo_elevenlabs hochladen.');
