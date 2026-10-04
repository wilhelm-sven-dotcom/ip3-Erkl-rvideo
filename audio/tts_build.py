"""Layout-Sprecher: erzeugt je Zeile mehrere Takes (Thorsten-Voice, CC0), bewertet sie per
Whisper-Erkennung gegen den Sollsatz und speichert den besten Take als 48-kHz-WAV.

Modelle (nicht im Repository, nach /home/user/models entpacken):
  https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-de_DE-thorsten-high.tar.bz2
  https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2
Aufruf: python3 audio/tts_build.py [L07 L11 ...]   (ohne Argumente alle Zeilen)
"""
import json, re, os, sys, numpy as np, soundfile as sf, difflib
import sherpa_onnx
from scipy.signal import resample_poly
M="/home/user/models/vits-piper-de_DE-thorsten-high"; W="/home/user/models/sherpa-onnx-whisper-small"
SPEED=float(os.environ.get("VO_SPEED","0.9")); TAKES=int(os.environ.get("VO_TAKES","5"))
def mk_tts(ns, nsw):
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f"{M}/de_DE-thorsten-high.onnx",tokens=f"{M}/tokens.txt",
        data_dir=f"{M}/espeak-ng-data",noise_scale=ns,noise_scale_w=nsw),num_threads=4),max_num_sentences=1))
engines=[mk_tts(0.667,0.8), mk_tts(0.5,0.6), mk_tts(0.75,0.9)]
rec=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f"{W}/small-encoder.int8.onnx",decoder=f"{W}/small-decoder.int8.onnx",
        tokens=f"{W}/small-tokens.txt",language="de",task="transcribe",num_threads=4)
def norm(s): return re.sub(r"[^a-zäöüß ]","",s.lower().replace("-"," ")).split()
def asr(x,sr):
    y=resample_poly(x,16000,sr).astype(np.float32); s=rec.create_stream(); s.accept_waveform(16000,y); rec.decode_stream(s); return s.result.text.strip()
def trim(x,sr,thr=0.006,pad=0.03):
    idx=np.where(np.abs(x)>thr)[0]
    if not len(idx): return x
    a=max(0,idx[0]-int(pad*sr)); b=min(len(x),idx[-1]+int(pad*sr)); return x[a:b]
lines=json.load(open("vo_lines.json")); os.makedirs("vo",exist_ok=True); out=[]
only=set(sys.argv[1:])
prev={l["id"]:l for l in (json.load(open("vo/vo_takes.json")) if os.path.exists("vo/vo_takes.json") else [])}
for L in lines:
    if only and L["id"] not in only and L["id"] in prev: out.append(prev[L["id"]]); continue
    txt=L.get("tts",L["text"]); best=None
    for k in range(TAKES):
        eng=engines[k%len(engines)]
        a=eng.generate(txt,sid=0,speed=SPEED); x=trim(np.array(a.samples,dtype=np.float32),a.sample_rate)
        hyp=asr(x,a.sample_rate); ref=norm(L["text"])
        score=difflib.SequenceMatcher(None," ".join(ref)," ".join(norm(hyp))).ratio()
        if best is None or score>best[0]+1e-9: best=(score,x,a.sample_rate,hyp,k)
    score,x,sr,hyp,k=best
    y=resample_poly(x,48000,sr).astype(np.float32)
    sf.write(f"vo/{L['id']}.wav",y,48000,subtype="PCM_24")
    d=len(y)/48000; out.append({**L,"dur":round(d,3),"asr":hyp,"score":round(score,3),"take":k})
    print(f"{L['id']:5s} {d:5.2f}s score={score:.3f} take={k} | {hyp}",flush=True)
json.dump(out,open("vo/vo_takes.json","w"),ensure_ascii=False,indent=1)
print("total",round(sum(o["dur"] for o in out),2),"s")
