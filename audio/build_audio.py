"""Tonspur des Erklärvideos: Layout-Musik, Soundeffekte, Layout-Sprecher und Mischung.

Alles wird synthetisch erzeugt (keine Fremdlizenzen). Musik in d-Moll mit Auflösung nach
F-Dur, 96 BPM, ein Takt = 2,5 s, 36 Takte = 90 s. Die Sprecherspur wird aus den Einzelsätzen
(vo/*.wav) an den Zeitpunkten aus engine/src/cues.json zusammengesetzt; die Musik wird unter
der Stimme abgesenkt (Ducking). Ergebnis: Stems und Mischung als WAV in audio/out/.

    python3 audio/build_audio.py
"""
import json, os
import numpy as np
import soundfile as sf
from numba import njit
from scipy.signal import fftconvolve, butter, sosfilt, resample_poly

SR = 48000
DUR = 90.0
N = int(SR * DUR)
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20260504)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_of(n):
    return np.arange(n) / SR


# ---------------- DSP-Bausteine ----------------
def saw(f, n, phase0=0.0):
    dt = f / SR
    ph = (phase0 + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt
    y[m] -= x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / dt
    y[m2] -= x * x + x + x + 1
    return y


@njit(cache=True)
def svf_lp(x, cutoff, q):
    # Zustandsvariablenfilter (Tiefpass) mit zeitvariabler Grenzfrequenz
    y = np.zeros_like(x)
    ic1 = 0.0
    ic2 = 0.0
    for i in range(x.shape[0]):
        g = np.tan(np.pi * min(cutoff[i], 20000.0) / 48000.0)
        k = 1.0 / q
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        y[i] = v2
    return y


def adsr(n, a, d, s, r, hold):
    """Hüllkurve: a, d, r in s; hold = Dauer bis Release-Beginn."""
    t = t_of(n)
    e = np.zeros(n)
    e = np.where(t < a, t / max(a, 1e-4), e)
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / max(d, 1e-4)
    m = (t >= a + d) & (t < hold)
    e[m] = s
    m = t >= hold
    lvl = s if hold >= a + d else max(0.0, 1 - (1 - s) * (hold - a) / max(d, 1e-4)) if hold >= a else hold / max(a, 1e-4)
    e[m] = lvl * np.exp(-(t[m] - hold) / max(r / 4.6, 1e-4))
    return e


def reverb_ir(seconds=2.6, predelay=0.02, damp=6000):
    n = int(seconds * SR)
    t = t_of(n)
    ir = np.zeros((n, 2))
    for c in range(2):
        noise = rng.standard_normal(n)
        sos = butter(2, damp, 'lp', fs=SR, output='sos')
        noise = sosfilt(sos, noise)
        ir[:, c] = noise * np.exp(-6.9 * t / seconds)
    pd = int(predelay * SR)
    ir = np.vstack([np.zeros((pd, 2)), ir])
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    return ir


IR = reverb_ir()


def reverb(x, wet=0.25):
    y = np.zeros_like(x)
    for c in range(2):
        y[:, c] = fftconvolve(x[:, c], IR[:, c])[: len(x)]
    return x * (1 - wet) + y * wet


def pan(mono, p):
    # p: -1 links, +1 rechts, gleichleistungs-Panorama
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def place(buf, sig, t0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= len(buf):
        return
    i1 = min(len(buf), i0 + len(sig))
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
        i1 = min(len(buf), len(sig))
    buf[i0:i1] += sig[: i1 - i0] * gain


def db(x):
    return 10 ** (x / 20)


# ---------------- Musik ----------------
CH = {
    'Dm9': [50, 57, 60, 64, 65],
    'Bbmaj9': [46, 53, 57, 60, 62],
    'Fmaj7': [53, 57, 60, 64],
    'Fmaj9': [41, 53, 57, 60, 64, 67],
    'Csus2': [48, 55, 62, 64],
    'Csus4': [48, 55, 60, 65],
    'A7sus4': [45, 57, 62, 64, 67],
}
ROOTS = {'Dm9': 38, 'Bbmaj9': 34, 'Fmaj7': 41, 'Fmaj9': 41, 'Csus2': 36, 'Csus4': 36, 'A7sus4': 33}
PROG = (['Dm9', 'Dm9', 'Dm9', 'Bbmaj9']
        + ['Dm9', 'Dm9', 'Bbmaj9', 'Bbmaj9', 'Fmaj7', 'Fmaj7', 'Csus2', 'Csus2',
           'Dm9', 'Dm9', 'Bbmaj9', 'Bbmaj9', 'Fmaj7', 'Fmaj7', 'Csus2', 'Csus2',
           'Dm9', 'Dm9', 'Bbmaj9', 'Bbmaj9', 'Csus2', 'Csus2']
        + ['Fmaj9', 'Fmaj9', 'Csus2', 'Csus2', 'Bbmaj9', 'Csus4']
        + ['Fmaj9', 'Fmaj9', 'Fmaj9', 'Fmaj9'])
assert len(PROG) == 36


def chord_at(bar):
    return PROG[min(35, max(0, bar))]


def build_pad():
    out = np.zeros((N, 2))
    # Akkordwechsel: Segmente gleicher Akkorde zusammenfassen
    segs = []
    b = 0
    while b < 36:
        c = PROG[b]
        e = b
        while e + 1 < 36 and PROG[e + 1] == c:
            e += 1
        segs.append((c, b * BAR, (e + 1) * BAR))
        b = e + 1
    for (c, a, z) in segs:
        hold = z - a
        rel = 1.6
        n = int((hold + rel) * SR)
        if a == 0:
            att = 2.2
        else:
            att = 0.35
        env = adsr(n, att, 0.6, 0.85, rel, hold)
        if z >= DUR:  # Schlussakkord klingt aus
            env *= np.clip((DUR - a - t_of(n)) / 3.0, 0, 1)
        sig = np.zeros((n, 2))
        for j, m in enumerate(CH[c]):
            f = mtof(m + 12 if m < 45 else m)
            for d, p in ((-7, -0.6), (0, 0.0), (7, 0.6)):
                ff = f * 2 ** (d / 1200)
                v = saw(ff, n, rng.random()) * 0.5 + 0.5 * np.sin(2 * np.pi * ff * t_of(n) + rng.random() * 6)
                sig += pan(v, p * 0.8) / (len(CH[c]) * 3)
        # weiche Bewegung im Filter, Öffnung abhängig vom Abschnitt
        tt = a + t_of(n)
        base = np.interp(tt, [0, 10, 22.5, 37.5, 52.5, 65, 80, 90], [700, 900, 1300, 1400, 1500, 1500, 2200, 1500])
        cut = base * (1 + 0.25 * np.sin(2 * np.pi * tt / 7.5))
        for ch in range(2):
            sig[:, ch] = svf_lp(np.ascontiguousarray(sig[:, ch]), cut, 0.75)
        place(out, sig * env[:, None], a)
    return out


def build_sub():
    out = np.zeros(N)
    for bar in range(4, 36):
        c = chord_at(bar)
        f = mtof(ROOTS[c])
        a = bar * BAR
        hits = [(0.0, 1.7), (1.5 * BEAT, 0.9), (2 * BEAT, 1.6)] if bar < 32 else [(0.0, 2.4)]
        if bar >= 33:
            continue
        for off, ln in hits:
            n = int((ln + 0.4) * SR)
            env = adsr(n, 0.01, 0.25, 0.7, 0.35, ln)
            x = np.sin(2 * np.pi * f * t_of(n)) + 0.15 * np.sin(4 * np.pi * f * t_of(n))
            x = np.tanh(1.6 * x) * env
            place(out, x, a + off, 0.5 if off == 0 else 0.33)
    return pan(out, 0.0)


def build_arp():
    out = np.zeros((N, 2))
    step = BEAT / 4
    for bar in range(4, 33):
        c = CH[chord_at(bar)]
        notes = [m + 12 for m in c[1:]] + [c[1] + 24]
        density = 4 if bar < 32 else 2
        for s in range(16):
            if s % (4 // density if density < 4 else 1) and density < 4:
                continue
            m = notes[(s * 3 + bar) % len(notes)]
            f = mtof(m)
            n = int(0.42 * SR)
            env = np.exp(-t_of(n) / 0.11) * (1 - np.exp(-t_of(n) / 0.002))
            x = 0.6 * np.sin(2 * np.pi * f * t_of(n)) + 0.4 * saw(f, n)
            cut = 900 + 2600 * np.exp(-t_of(n) / 0.06)
            x = svf_lp(np.ascontiguousarray(x), cut, 0.9) * env
            acc = 1.0 if s % 4 == 0 else 0.62
            place(out, pan(x, 0.45 * np.sin(s * 0.9 + bar)), bar * BAR + s * step, 0.16 * acc)
    # Echo (punktierte Achtel)
    d = int(0.75 * BEAT * SR)
    y = out.copy()
    for k in range(1, 4):
        y[d * k:] += out[: -d * k][:, ::-1] * (0.32 ** k)
    return y


def build_drums():
    out = np.zeros((N, 2))
    kick_n = int(0.45 * SR)
    tk = t_of(kick_n)
    fk = 46 + 70 * np.exp(-tk / 0.035)
    kick = np.sin(2 * np.pi * np.cumsum(fk) / SR) * np.exp(-tk / 0.16)
    kick += 0.25 * rng.standard_normal(kick_n) * np.exp(-tk / 0.004)
    kick = np.tanh(1.4 * kick)
    hat_n = int(0.09 * SR)
    hat = rng.standard_normal(hat_n) * np.exp(-t_of(hat_n) / 0.018)
    hat = sosfilt(butter(4, 7000, 'hp', fs=SR, output='sos'), hat)
    tick_n = int(0.05 * SR)
    tick = np.sin(2 * np.pi * 2400 * t_of(tick_n)) * np.exp(-t_of(tick_n) / 0.008)
    for bar in range(36):
        a = bar * BAR
        if 4 <= bar < 32:
            for b in (0, 2):
                place(out, pan(kick, 0), a + b * BEAT, 0.55)
        if 9 <= bar < 32:
            for e in range(4):
                place(out, pan(hat, 0.25), a + (e + 0.5) * BEAT, 0.07)
        if bar < 4:  # Szene 1: leises Ticken wie ein Messintervall
            for e in range(8):
                place(out, pan(tick, -0.2 + 0.4 * (e % 2)), a + e * BEAT / 2, 0.05)
    return out


# ---------------- Soundeffekte ----------------
def sweep(f0, f1, dur, shape='exp'):
    n = int(dur * SR)
    tt = t_of(n) / dur
    f = f0 * (f1 / f0) ** tt if shape == 'exp' else f0 + (f1 - f0) * tt
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise_sweep(f0, f1, dur, q=1.2):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    tt = t_of(n) / dur
    cut = f0 * (f1 / f0) ** tt
    return svf_lp(np.ascontiguousarray(x), cut, q)


def blip(f, dur=0.35, tone=1.0):
    n = int(dur * SR)
    tt = t_of(n)
    x = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt) * tone
    return x * np.exp(-tt / (dur / 5)) * (1 - np.exp(-tt / 0.003))


def whoosh(dur, f0=300, f1=5000, peak=0.6):
    n = int(dur * SR)
    x = noise_sweep(f0, f1, dur, 0.9)
    tt = t_of(n) / dur
    env = np.where(tt < peak, (tt / peak) ** 2, np.exp(-(tt - peak) / (1 - peak) * 4))
    return x * env


def build_sfx():
    out = np.zeros((N, 2))
    # Szene 1: Leistung fällt (sanfter Abwärtston), Sturzflug (Riser)
    n = int(2.2 * SR)
    pd = sweep(660, 165, 2.2) * np.exp(-t_of(n) / 1.2) * (1 - np.exp(-t_of(n) / 0.05))
    place(out, pan(pd, 0.3), 2.55, 0.09)
    r = whoosh(2.3, 200, 7000, 0.92)
    place(out, pan(r, 0), 8.45, 0.10)
    place(out, pan(sweep(220, 880, 2.2) * np.linspace(0, 1, int(2.2 * SR)) ** 2, 0), 8.5, 0.035)
    # Datenpunkt zündet, Datenstrom, Ankunft
    place(out, pan(blip(1318.5, 0.6), 0), 10.85, 0.16)
    place(out, pan(whoosh(1.7, 400, 3500, 0.7), -0.3), 12.3, 0.06)
    place(out, pan(blip(987.8, 0.5), 0.2), 13.95, 0.12)
    # Übergang in die schematische Darstellung
    place(out, pan(whoosh(0.9, 300, 6000, 0.55), 0), 14.4, 0.09)
    for i, tt in enumerate([15.3, 15.2, 15.8, 16.8, 17.95]):
        place(out, pan(blip([1046.5, 1174.7, 1318.5, 1568.0, 1760.0][i], 0.4), -0.4 + i * 0.2), tt, 0.07)
    # Bündeln und Morph ins Dashboard
    place(out, pan(sweep(330, 990, 0.6) * np.linspace(0, 1, int(0.6 * SR)), 0), 19.75, 0.04)
    place(out, pan(whoosh(1.0, 500, 7000, 0.5), 0.1), 20.3, 0.08)
    # Reiterwechsel (leise Klicks)
    for tt in [22.65, 37.6, 52.65, 65.2]:
        place(out, pan(blip(2093.0, 0.12), 0.3), tt, 0.05)
    # Eingriffe markiert
    for tt in [25.35, 28.65]:
        place(out, pan(blip(392.0, 0.7, 0.5), 0), tt, 0.10)
        place(out, pan(blip(784.0, 0.5), 0.2), tt + 0.03, 0.05)
    # Fläche entgangener Energie
    place(out, pan(whoosh(1.4, 200, 2500, 0.6), 0), 49.0, 0.06)
    # Prüfhaken und Abweichung
    for tt in [55.9, 57.25]:
        place(out, pan(blip(1567.98, 0.35), 0.2), tt, 0.07)
        place(out, pan(blip(2093.0, 0.3), 0.2), tt + 0.07, 0.05)
    place(out, pan(blip(523.25, 0.6, 0.4), -0.1), 58.4, 0.09)
    place(out, pan(whoosh(0.8, 300, 4000, 0.5), -0.3), 61.2, 0.07)
    # Lageplan -> Luftbild
    place(out, pan(whoosh(1.6, 150, 6000, 0.7), 0), 70.2, 0.10)
    # Speicher-Szenario baut sich auf
    for i in range(9):
        place(out, pan(blip(1046.5 * 2 ** ([0, 4, 7, 12, 7, 4, 9, 12, 16][i] / 12), 0.5), -0.5 + i * 0.12), 76.4 + i * 0.12, 0.035)
    # Bogen zeichnet sich, Abbinder
    place(out, pan(sweep(440, 1760, 1.8) * np.sin(np.linspace(0, np.pi, int(1.8 * SR))) ** 2, 0.2), 82.6, 0.03)
    hit_n = int(4.5 * SR)
    th = t_of(hit_n)
    boom = np.sin(2 * np.pi * np.cumsum(55 + 40 * np.exp(-th / 0.05)) / SR) * np.exp(-th / 0.9)
    bell = sum(np.sin(2 * np.pi * mtof(m) * th) * np.exp(-th / (2.6 - 0.3 * k)) for k, m in enumerate([77, 81, 84, 88]))
    place(out, pan(boom, 0), 85.0, 0.22)
    place(out, pan(bell * (1 - np.exp(-th / 0.004)), 0), 85.05, 0.035)
    return out


# ---------------- Sprecher ----------------
def build_vo():
    cues = json.load(open(os.path.join(ROOT, 'engine', 'src', 'cues.json')))
    vo = np.zeros(N)
    hp = butter(2, 80, 'hp', fs=SR, output='sos')
    for c in cues['vo']:
        x, sr = sf.read(os.path.join(HERE, 'vo', c['id'] + '.wav'))
        if x.ndim > 1:
            x = x.mean(axis=1)
        if sr != SR:
            x = resample_poly(x, SR, sr)
        x = sosfilt(hp, x)
        # leichte Präsenzanhebung um 3 kHz
        pres = sosfilt(butter(2, [2200, 4500], 'bp', fs=SR, output='sos'), x)
        x = x + 0.25 * pres
        # weiche Ein- und Ausblendung
        f = int(0.012 * SR)
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
        x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.09
        place(vo, x, c['start'])
    # sanfte Kompression
    env = np.sqrt(fftconvolve(vo ** 2, np.ones(int(0.03 * SR)) / int(0.03 * SR), mode='same').clip(0))
    thr = 0.08
    g = np.where(env > thr, (thr / (env + 1e-9)) ** 0.4, 1.0)
    vo = vo * g
    return vo, cues


def duck_curve(cues, depth_db=-9.0, att=0.12, rel=0.45):
    g = np.zeros(N)
    for c in cues['vo']:
        a, z = c['start'] - att, c['end'] + rel
        i0, i1 = max(0, int(a * SR)), min(N, int(z * SR))
        g[i0:i1] = 1
    k = int(0.25 * SR)
    g = np.convolve(g, np.ones(k) / k, mode='same')
    return db(depth_db * g)


def lufs(x):
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    return meter.integrated_loudness(x)


def main():
    print('Musik ...')
    pad = build_pad()
    sub = build_sub()
    arp = build_arp()
    drums = build_drums()
    music = pad * db(-4) + sub * db(-6) + arp * db(-3) + drums * db(-5)
    music = reverb(music, 0.22)
    print('SFX ...')
    sfx = reverb(build_sfx(), 0.3)
    print('Sprecher ...')
    vo, cues = build_vo()
    duck = duck_curve(cues)
    # Musik-Grundpegel: Intro und Abbinder etwas präsenter
    lvl = np.interp(t_of(N), [0, 9.5, 10.5, 80, 83, 85, 90], [1.0, 1.0, 0.85, 0.85, 1.25, 1.6, 1.6])
    music_d = music * (duck * lvl)[:, None]
    # Pegelziele der Stems
    vo2 = pan(vo, 0) / np.sqrt(0.5)
    vo2 = vo2 * db(-18.0 - lufs(vo2))
    music_d = music_d * db(-24.5 - lufs(music))
    sfx = sfx * db(-34.0 - lufs(sfx))
    mix = vo2 + music_d + sfx
    # Gesamtlautheit -16 LUFS, True-Peak-Sicherheit
    mix *= db(-16.0 - lufs(mix))
    peak = np.max(np.abs(mix))
    if peak > db(-1.5):
        mix = np.tanh(mix / db(-1.5)) * db(-1.5)
    fade = int(0.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    for name, x in [('stem_sprecher', vo2), ('stem_musik', music_d), ('stem_sfx', sfx), ('mix', mix)]:
        sf.write(os.path.join(OUT, f'{name}.wav'), x.astype(np.float32), SR, subtype='PCM_24')
    # Version ohne Sprecher (Musik + SFX), z. B. für stummes Autoplay mit Untertiteln
    nov = music * lvl[:, None] * db(-24.5 - lufs(music)) * db(2) + sfx
    nov *= db(-16.0 - lufs(nov))
    sf.write(os.path.join(OUT, 'mix_ohne_sprecher.wav'), nov.astype(np.float32), SR, subtype='PCM_24')
    print('LUFS mix', round(lufs(mix), 2), 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix))), 2))


if __name__ == '__main__':
    main()
