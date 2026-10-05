# ip³ Erklärvideo: Betriebsdaten, Abregelung, Abrechnung

90-Sekunden-Werbe- und Erklärvideo der ip³ Energietechnik GmbH zur Datenlösung für Freiflächen-Photovoltaikanlagen: wer den Solarpark regelt, welche Erzeugung dadurch entgeht, ob Abrechnungen plausibel sind, dazu technische Betriebsführung und Beratung.

## Lieferumfang

| Datei | Inhalt |
|---|---|
| `output/ip3_Erklaervideo_16x9.mp4` | Film 1920 × 1080, 30 fps, mit Sprecher (ElevenLabs), Layout-Musik und Effekten, Untertitel als zuschaltbare Spur |
| `output/ip3_Erklaervideo_16x9_UT.mp4` | dieselbe Fassung mit eingebrannten Untertiteln (für stumme Wiedergabe, Social Media, Messen) |
| `output/ip3_Erklaervideo_DE.srt`, `.vtt` | Untertitel für YouTube und Website |
| `output/audio/` | Stems (Sprecher, Musik, Effekte), Mischung, Mischung ohne Sprecher |
| `docs/Produktionsvorlage.md` | Leitmotiv, Sprechertext, Storyboard, Produktionsanweisungen und Prompts, Assetliste, 9:16-Hinweise, Beispieldaten |
| `docs/storyboard/` | Standbilder je Storyboard-Einstellung |

Der Film ist vollständig produziert. Die Stimme stammt aus ElevenLabs (Alexander, Deep TV Narrator, eleven_multilingual_v2; Nutzungsrechte gemäß ElevenLabs-Abo prüfen). Die frühere Thorsten-Layoutstimme liegt in audio/vo_layout/. Musik: „Technology“ von verclub (Pixabay, ID 550887), auf 90 s geschnitten (audio/build_audio.py, M_EDIT). Lizenzbedingungen auf der Pixabay-Seite des Titels prüfen; ohne die Datei fällt das Skript auf die synthetische Layout-Musik zurück. Außenbilder in Eröffnung, Speicher-Szenario und Schluss sind KI-generierte Fotoplatten (engine/assets/photos/, im Bild als Symbolbild gekennzeichnet). Alle Zahlen sind Beispieldaten, das Dashboard ist eine schematische Nachbildung; beides ist im Bild gekennzeichnet.

## Aufbau des Projekts

```
engine/            Render-Stage: Three.js-Welt (Park, Himmel, Kamera) und 2D-Ebenen (HTML/SVG)
  src/world/       Parklayout, Modulshader, Gelände, Kamerafahrten, Datenstrom, Speicher
  src/overlay/     Headlines, Messwertkarte, Schaltschrank, Dashboard, Abbinder
  src/data.js      Beispieldaten (Tagesverlauf, Eingriffe, Energiemengen, Monatswerte)
  src/cues.json    Sprecher-Timeline, Grundlage für Bild, Ton und Untertitel
  assets/          Markenschriften (OFL) und Original-Logodateien
audio/             Layout-Sprecher (tts_build.py), Musik, Effekte und Mischung (build_audio.py)
render/            Bildsequenz-Renderer (Playwright/Chromium), Untertitel, Kontaktbögen
```

Jedes Einzelbild ist eine reine Funktion der Zeit (`window.seek(t)`), daher lassen sich einzelne Szenen gezielt neu rendern.

## Neu erzeugen

Voraussetzungen: Node 22 mit Playwright und Chromium, Python 3.11 mit numpy, scipy, soundfile, numba, pyloudnorm, sherpa-onnx, ffmpeg mit libx264 und libass.

```bash
cd engine && npm install && cd ..
# 1. Layout-Sprecher (Modelle siehe audio/tts_build.py) und Tonmischung
python3 audio/tts_build.py
python3 audio/build_audio.py
# 2. Untertitel
python3 render/subtitles.py
# 3. Bilder (zwei Prozesse parallel) und Encoding
node render/render.mjs --from 0 --to 45 --fps 30 --quality 95 --out out/final &
node render/render.mjs --from 45 --to 90 --fps 30 --quality 95 --out out/final
bash render/encode.sh
```

Einzelne Standbilder: `node render/render.mjs --times 12.5,31 --q 0.5 --out out/stills`.

## Sprecher austauschen

Profiaufnahme satzweise nach `docs/Produktionsvorlage.md` (Abschnitt 2) aufnehmen, als `audio/vo/L01.wav` bis `L30.wav` ablegen (Dateinamen wie in `engine/src/cues.json`), dann `python3 audio/build_audio.py` und `bash render/encode.sh`. Weicht eine Satzlänge deutlich ab, die Startzeit in `cues.json` anpassen; Einblendungen, Untertitel und Ducking folgen automatisch.
