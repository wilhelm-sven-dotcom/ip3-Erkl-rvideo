"""Untertitel aus der Sprecher-Timeline (engine/src/cues.json).

Erzeugt SRT und WebVTT (vollständig, für YouTube/Website als zuschaltbare Untertitel) sowie
eine ASS-Datei zum Einbrennen. In der Einbrenn-Fassung entfallen Sätze, die wörtlich als
Texteinblendung im Bild stehen (Abschlussbotschaft und Handlungsaufforderung), damit kein
Text doppelt erscheint.

    python3 render/subtitles.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'output')
os.makedirs(OUT, exist_ok=True)
cues = json.load(open(os.path.join(ROOT, 'engine', 'src', 'cues.json')))['vo']

MERGE = [('L19a', 'L19b', 'L19c')]
NO_BURN = {'L28', 'L29', 'L30'}
MAXLEN = 42


def wrap(text):
    if len(text) <= MAXLEN:
        return [text]
    words = text.split(' ')
    best, bestscore = None, 1e9
    for i in range(1, len(words)):
        a, b = ' '.join(words[:i]), ' '.join(words[i:])
        if len(a) > MAXLEN or len(b) > MAXLEN:
            continue
        score = abs(len(a) - len(b)) - (8 if a.endswith((',', '.', ':')) else 0)
        if score < bestscore:
            best, bestscore = [a, b], score
    return best or [text]


items = []
skip = set()
for c in cues:
    if c['id'] in skip:
        continue
    grp = next((g for g in MERGE if g[0] == c['id']), None)
    if grp:
        parts = [x for x in cues if x['id'] in grp]
        text = ' '.join(p['text'] for p in parts)
        items.append({'ids': list(grp), 'start': parts[0]['start'], 'end': parts[-1]['end'], 'text': text})
        skip.update(grp)
    else:
        items.append({'ids': [c['id']], 'start': c['start'], 'end': c['end'], 'text': c['text']})

# Mindeststandzeit 1,2 s und kleine Nachlaufzeit, ohne Überlappung
for i, it in enumerate(items):
    end = max(it['end'] + 0.25, it['start'] + 1.2)
    if i + 1 < len(items):
        end = min(end, items[i + 1]['start'] - 0.05)
    it['end'] = end
    it['lines'] = wrap(it['text'])


def ts(t, sep=','):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d}{sep}{int(round((s - int(s)) * 1000)):03d}"


with open(os.path.join(OUT, 'ip3_Erklaervideo_DE.srt'), 'w', encoding='utf-8') as f:
    for i, it in enumerate(items, 1):
        f.write(f"{i}\n{ts(it['start'])} --> {ts(it['end'])}\n" + '\n'.join(it['lines']) + '\n\n')

with open(os.path.join(OUT, 'ip3_Erklaervideo_DE.vtt'), 'w', encoding='utf-8') as f:
    f.write('WEBVTT\nLanguage: de\n\n')
    for i, it in enumerate(items, 1):
        f.write(f"{i}\n{ts(it['start'], '.')} --> {ts(it['end'], '.')}\n" + '\n'.join(it['lines']) + '\n\n')


def ass_ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h:d}:{m:02d}:{s:05.2f}"


# ASS: Libre Franklin SemiBold, weiß auf halbtransparenter Navy-Fläche, unten mittig
head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: UT,Libre Franklin SemiBold,40,&H00FFFFFF,&H00FFFFFF,&H3C3D1A0C,&H3C3D1A0C,0,0,0,0,100,100,0,0,3,14,0,2,200,200,42,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
with open(os.path.join(OUT, 'ip3_Erklaervideo_DE_einbrennen.ass'), 'w', encoding='utf-8') as f:
    f.write(head)
    for it in items:
        if set(it['ids']) & NO_BURN:
            continue
        txt = r'\N'.join(it['lines'])
        f.write(f"Dialogue: 0,{ass_ts(it['start'])},{ass_ts(it['end'])},UT,,0,0,0,,{txt}\n")

print(len(items), 'Untertitel')
for it in items:
    print(f"{it['start']:6.2f}-{it['end']:6.2f}  {' / '.join(it['lines'])}")
