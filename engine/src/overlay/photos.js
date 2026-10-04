import { el, svgEl, C, prog, ease, lerp, clamp } from './base.js';

// Fotorealistische Bildplatten (generiert, siehe docs) für Eröffnung, Speicher-Szenario und
// Schlussbild. Langsame Kamerabewegung über Skalierung; das Speicher-Szenario wird als
// Strichmodell perspektivisch auf die Schotterfläche gezeichnet.

// Schotterfläche neben der Station im Nachmittagsbild (Bildkoordinaten 1920 × 1080)
const PAD = { tl: [1432, 816], tr: [1553, 834], br: [1458, 943], bl: [1321, 886] };

function homography(u, v) {
  // bilineare Abbildung des Einheitsquadrats auf das Viereck (reicht für die kleine Fläche)
  const { tl, tr, br, bl } = PAD;
  const top = [lerp(tl[0], tr[0], u), lerp(tl[1], tr[1], u)];
  const bot = [lerp(bl[0], br[0], u), lerp(bl[1], br[1], u)];
  return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)];
}

const SHOTS = [
  // Eröffnung: Tageslicht-Luftbild, langsamer Zug Richtung Station, dann Sturz in die 3D-Fahrt
  { src: 'assets/photos/luftbild_tag.jpg', a: 0.0, b: 9.15, fi: 0.8, fo: 0.7, s0: 1.0, s1: 1.12, ox: 0.74, oy: 0.82, dive: [8.45, 9.15] },
  // Speicher-Szenario
  { src: 'assets/photos/nachmittag_speicherflaeche.jpg', a: 70.95, b: 80.7, fi: 0.7, fo: 0.7, s0: 1.0, s1: 1.22, ox: 0.76, oy: 0.82, bess: true },
  // Schlussbild
  { src: 'assets/photos/horizont.jpg', a: 80.0, b: 85.4, fi: 0.7, fo: 0.4, s0: 1.0, s1: 1.06, ox: 0.5, oy: 0.35 },
];

export class Photos {
  constructor(root) {
    this.root = el('div', 'abs', root);
    Object.assign(this.root.style, { inset: '0', overflow: 'hidden' });
    this.items = SHOTS.map((s) => {
      const box = el('div', 'abs', this.root);
      Object.assign(box.style, { left: 0, top: 0, width: '1920px', height: '1080px', transformOrigin: `${s.ox * 100}% ${s.oy * 100}%`, willChange: 'transform, opacity' });
      const img = el('img', 'abs', box); img.src = s.src;
      Object.assign(img.style, { left: 0, top: 0, width: '1920px', height: '1080px' });
      let bess = null;
      if (s.bess) bess = this.buildBess(box);
      return { s, box, bess };
    });
    const tag = (this.tag = el('div', 'abs', root, 'Symbolbild'));
    Object.assign(tag.style, { right: '96px', top: '58px', fontFamily: 'var(--zahl)', fontWeight: 500, fontSize: '14px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', textShadow: '0 0 6px rgba(0,0,0,0.4)' });
  }

  buildBess(box) {
    const svg = svgEl('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, box);
    Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible' });
    const pad = svgEl('path', { d: '', fill: 'rgba(200,60,48,0.16)', stroke: C.akzent, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, svg);
    const q = [homography(0, 0), homography(1, 0), homography(1, 1), homography(0, 1)];
    pad.setAttribute('d', 'M' + q.map((p) => p.join(' ')).join(' L') + ' Z');
    const pxPerM = Math.hypot(PAD.tr[0] - PAD.tl[0], PAD.tr[1] - PAD.tl[1]) / 24;
    const boxes = [];
    const foot = [[0.10, 0.30, 0.14, 0.82], [0.41, 0.59, 0.14, 0.82], [0.70, 0.88, 0.14, 0.82]];
    foot.forEach(([u0, u1, v0, v1]) => {
      const g = svgEl('g', {}, svg);
      const fill = svgEl('path', { fill: 'rgba(255,255,255,0.18)', stroke: 'none' }, g);
      const edges = svgEl('path', { fill: 'none', stroke: '#fff', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, g);
      boxes.push({ g, fill, edges, f: [homography(u0, v0), homography(u1, v0), homography(u1, v1), homography(u0, v1)] });
    });
    return { svg, pad, boxes, h: 2.9 * pxPerM };
  }

  drawBess(b, t) {
    const pk = ease.inOutSine(prog(76.0, 76.8, t));
    b.pad.style.opacity = String(pk);
    b.boxes.forEach((bx, i) => {
      const a = 76.4 + i * 0.25, p = ease.outCubic(prog(a, a + 0.9, t));
      const h = b.h * p;
      const top = bx.f.map(([x, y]) => [x, y - h]);
      const P = (pts) => pts.map((q) => q.map((v) => v.toFixed(1)).join(' '));
      let d = 'M' + P(bx.f).join(' L') + ' Z M' + P(top).join(' L') + ' Z';
      for (let k = 0; k < 4; k++) d += ` M${P([bx.f[k]])} L${P([top[k]])}`;
      bx.edges.setAttribute('d', d);
      // sichtbare Hülle (Draufsicht und Front) leicht gefüllt
      bx.fill.setAttribute('d', 'M' + P([bx.f[3], bx.f[2], top[2], top[1], top[0], top[3]]).join(' L') + ' Z');
      bx.g.style.opacity = String(p > 0.001 ? 1 : 0);
    });
  }

  update(t) {
    let tagOn = 0, anchor = null;
    for (const it of this.items) {
      const s = it.s;
      const on = t > s.a && t < s.b;
      it.box.style.display = on ? 'block' : 'none';
      if (!on) continue;
      let o = Math.min(ease.inOutSine(prog(s.a, s.a + s.fi, t)), 1 - ease.inOutSine(prog(s.b - s.fo, s.b, t)));
      let sc = lerp(s.s0, s.s1, ease.inOutSine(prog(s.a, s.b, t)));
      let blur = 0;
      if (s.dive) {
        const k = ease.inCubic(prog(s.dive[0], s.dive[1], t));
        sc *= 1 + 0.9 * k; blur = 6 * k;
      }
      if (s.a === 0) o = Math.min(1, prog(0, 0.8, t)) * (1 - ease.inOutSine(prog(s.dive[0] + 0.15, s.b, t)));
      it.box.style.opacity = String(o);
      it.box.style.transform = `scale(${sc.toFixed(5)})`;
      it.box.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
      tagOn = Math.max(tagOn, o);
      if (it.bess) {
        this.drawBess(it.bess, t);
        // Ankerpunkt für das Etikett (Mitte der Fläche, transformiert)
        const c = homography(0.5, 0.4);
        const ox = s.ox * 1920, oy = s.oy * 1080;
        anchor = [ox + (c[0] - ox) * sc, oy + (c[1] - oy - it.bess.h) * sc];
      }
    }
    // Kennzeichnung nur, wenn keine schematische Kennzeichnung aktiv ist und vor dem Abbinder
    this.tag.style.opacity = String(t < 84.4 ? tagOn : 0);
    return { bessScreen: anchor };
  }
}
