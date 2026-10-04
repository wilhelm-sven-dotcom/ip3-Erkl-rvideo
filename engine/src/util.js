// Mathe-, Easing- und Formatierungshelfer. Alles deterministisch: jede Animation ist eine
// reine Funktion der Zeit t (Sekunden), damit jedes Einzelbild exakt reproduzierbar ist.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (a, b, x) => clamp((x - a) / (b - a)); // 0..1 zwischen a und b
export const smooth = (a, b, x) => { const t = prog(a, b, x); return t * t * (3 - 2 * t); };
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  // Editorial-Kurve für Texteinblendungen, entspricht cubic-bezier(0.22,1,0.36,1)
  edit: (t) => 1 - Math.pow(1 - t, 4.2),
};

// Ein-/Ausblend-Hüllkurve: 0 vor a, 1 zwischen a+fi und b-fo, 0 nach b
export function env(t, a, b, fi = 0.4, fo = 0.4, e = ease.inOutSine) {
  if (t <= a || t >= b) return 0;
  const i = fi > 0 ? e(prog(a, a + fi, t)) : 1;
  const o = fo > 0 ? e(1 - prog(b - fo, b, t)) : 1;
  return Math.min(i, o);
}

// Deterministischer Zufall
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deutsche Zahlenschreibweise
export const fmt = (v, d = 1) =>
  Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

// Werte stückweise linear über Stützstellen interpolieren: keys = [[t, v], ...]
export function keys(t, k, e = ease.inOutCubic) {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const p = e(prog(k[i - 1][0], k[i][0], t));
      const a = k[i - 1][1], b = k[i][1];
      return Array.isArray(a) ? a.map((x, j) => lerp(x, b[j], p)) : lerp(a, b, p);
    }
  }
  return k[k.length - 1][1];
}

// 1D-Wertrauschen für leichte Messwertschwankungen
export function vnoise(x, seed = 1) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin((n + seed * 101.3) * 127.1) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

export function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
