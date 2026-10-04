import { el, svgEl, prog, ease, clamp, lerp } from '../util.js';

// Grundbausteine der 2D-Ebene: Textzeilen mit Maskeneinblendung, Satzendpunkt in Akzent-Rot.

export const C = {
  navy: '#0C1A3D', blau: '#2F2482', rot: '#8D0C07', akzent: '#C83C30', hell: '#E8E7EF', weiss: '#FFFFFF',
  lav: '#8D8AB8', lachs: '#E8A49C',
  line: 'rgba(255,255,255,0.14)', line2: 'rgba(255,255,255,0.28)', sec: 'rgba(232,231,239,0.62)',
};

// "Satz." -> Punkt in Akzent-Rot
export function dotify(s) {
  return s.replace(/\.$/, '<span style="color:#C83C30">.</span>');
}

// Mehrzeiliger Text mit Maskeneinblendung pro Zeile
export class Lines {
  constructor(parent, lines, { x, y, size = 56, weight = 800, lh = 1.06, color = '#fff', family = 'var(--head)', ls = '-0.018em', align = 'left', width, red = true } = {}) {
    this.root = el('div', 'abs', parent);
    Object.assign(this.root.style, { left: x + 'px', top: y + 'px', width: width ? width + 'px' : 'auto', textAlign: align });
    this.rows = lines.map((t) => {
      const mask = el('div', '', this.root);
      Object.assign(mask.style, { overflow: 'hidden', paddingBottom: '0.08em', marginBottom: '-0.08em' });
      const inner = el('div', '', mask, red ? dotify(t) : t);
      Object.assign(inner.style, { fontFamily: family, fontWeight: weight, fontSize: size + 'px', lineHeight: lh, letterSpacing: ls, color, whiteSpace: 'nowrap', willChange: 'transform' });
      return { mask, inner };
    });
  }
  // tin: Start, tout: Ende; ins: optional individuelle Startzeiten pro Zeile
  update(t, tin, tout, { stagger = 0.09, dur = 0.75, outDur = 0.45, ins } = {}) {
    let any = false;
    this.rows.forEach((r, i) => {
      const a = ins ? ins[i] : tin + i * stagger;
      const pin = ease.edit(prog(a, a + dur, t));
      const po = ease.inOutCubic(prog(tout - outDur + i * 0.03, tout + i * 0.03, t));
      const vis = t >= a && t < tout + 0.2;
      r.inner.style.transform = `translateY(${(1 - pin) * 105 - po * 30}%)`;
      r.inner.style.opacity = String(clamp(pin * 1.5) * (1 - po));
      r.mask.style.visibility = vis ? 'visible' : 'hidden';
      any = any || vis;
    });
    this.root.style.display = any ? 'block' : 'none';
  }
}

export function kicker(parent, text, { x, y, color = C.akzent }) {
  const k = el('div', 'abs', parent, text);
  Object.assign(k.style, { left: x + 'px', top: y + 'px', fontFamily: 'var(--zahl)', fontWeight: 500, fontSize: '19px', letterSpacing: '0.2em', textTransform: 'uppercase', color, whiteSpace: 'nowrap' });
  return k;
}

export function fadeEl(e, t, a, b, fi = 0.4, fo = 0.4, dy = 0) {
  const pin = ease.outCubic(prog(a, a + fi, t)), po = ease.inCubic(prog(b - fo, b, t));
  const o = pin * (1 - po);
  e.style.opacity = String(o);
  e.style.display = o > 0.001 ? 'block' : 'none';
  if (dy) e.style.transform = `translateY(${(1 - pin) * dy}px)`;
  return o;
}

// Strichlänge eines SVG-Pfads für Zeichenanimation
export function prepDraw(path) {
  const L = path.getTotalLength();
  path.style.strokeDasharray = `${L} ${L}`;
  path.style.strokeDashoffset = String(L);
  path.__L = L;
  return L;
}
export function draw(path, f) {
  path.style.strokeDashoffset = String(path.__L * (1 - clamp(f)));
}

export { el, svgEl, prog, ease, clamp, lerp };
