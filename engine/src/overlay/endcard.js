import { el, svgEl, C, Lines, fadeEl, prog, ease, clamp, lerp } from './base.js';

// Szene 7: Abschlussbotschaft über dem Schlussbild, dann Navy-Abbinder mit Originallogo,
// Zeichen 3 (Originaldatei, angeschnitten rechts) und Kontakt.

// Zeichen 3 nach Rezept "Titelfolie Navy": 120 % Bildhöhe, rechts angeschnitten, oben 12 %
const ZH = 1296, ZW = (ZH * 808) / 1052, ZX = 1920 - ZW * 0.74, ZY = -0.1 * ZH;
export const Z_DOT = [ZX + 0.2048 * ZW, ZY + 0.1564 * ZH]; // Mittelpunkt des Sonnenpunkts
const Z_DOT_R = (56.5 / 808) * ZW;

export class EndCard {
  constructor(root) {
    this.msg = new Lines(root, ['Verstehen, was Ihre Anlage leistet.', 'Erkennen, was in ihr steckt.'], { x: 112, y: 404, size: 62 });
    // Leitmotiv-Bogen: Verlauf der möglichen Leistung über den Himmel, der Punkt ist die Sonne
    const arcSvg = (this.arcSvg = svgEl('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, root));
    Object.assign(arcSvg.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible' });
    const H_END = 14.6, hs = 5.45;
    const shape = (h) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (h - hs) / 15.5))), 1.25);
    const sEnd = shape(H_END);
    const X0 = 112, Y0 = 336;
    const pt = (h) => [X0 + ((h - hs) / (H_END - hs)) * (Z_DOT[0] - X0), Y0 - (shape(h) / sEnd) * (Y0 - Z_DOT[1])];
    let d = ''; for (let i = 0; i <= 240; i++) { const h = hs + ((H_END - hs) * i) / 240; const [x, y] = pt(h); d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
    this.arc = svgEl('path', { d, fill: 'none', stroke: 'rgba(255,255,255,0.85)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, arcSvg);
    this.arcBase = svgEl('line', { x1: X0, y1: Y0, x2: Z_DOT[0], y2: Y0, stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1, 'stroke-dasharray': '4 6' }, arcSvg);
    this.arcL = this.arc.getTotalLength ? 0 : 0;

    const r = (this.root = el('div', 'abs', root));
    Object.assign(r.style, { inset: '0' });
    this.bg = el('div', 'abs', r); Object.assign(this.bg.style, { inset: '0', background: C.navy });
    // Zeichen 3: Kontur leise (20 %), Sonnenpunkt kräftiger (gleiche Originaldatei, auf den Punkt maskiert)
    const z = (this.z = el('img', 'abs', r)); z.src = 'assets/brand/zeichen-3-kontur-akzent.png';
    Object.assign(z.style, { left: ZX + 'px', top: ZY + 'px', width: ZW + 'px', height: ZH + 'px' });
    const zd = (this.zd = el('img', 'abs', r)); zd.src = 'assets/brand/zeichen-3-kontur-akzent.png';
    const rr = Z_DOT_R * 2.7;
    Object.assign(zd.style, { left: ZX + 'px', top: ZY + 'px', width: ZW + 'px', height: ZH + 'px',
      WebkitMaskImage: `radial-gradient(circle ${rr}px at ${Z_DOT[0] - ZX}px ${Z_DOT[1] - ZY}px, #000 55%, transparent 100%)`,
      maskImage: `radial-gradient(circle ${rr}px at ${Z_DOT[0] - ZX}px ${Z_DOT[1] - ZY}px, #000 55%, transparent 100%)` });
    // wandernder Punkt (Sonne -> Sonnenpunkt)
    this.sun = el('div', 'abs', r);
    Object.assign(this.sun.style, { width: '0px', height: '0px', borderRadius: '50%' });

    const logo = (this.logo = el('img', 'abs', r)); logo.src = 'assets/brand/ip3-energietechnik-weiss.svg';
    Object.assign(logo.style, { left: '112px', top: '108px', width: '470px' });
    this.claim = new Lines(r, ['Energie hoch drei.'], { x: 108, y: 392, size: 118, ls: '-0.025em' });
    this.cta = new Lines(r, ['Lassen Sie uns Ihren Solarpark genauer ansehen.'], { x: 114, y: 560, size: 38, weight: 400, ls: '0', color: C.hell, red: false });
    const url = (this.url = el('div', 'abs', r, 'www.ip3-energie.de'));
    Object.assign(url.style, { left: '114px', top: '640px', fontFamily: 'var(--zahl)', fontWeight: 700, fontSize: '38px', color: '#fff', letterSpacing: '0.01em' });
    this.bar = el('div', 'abs', r);
    Object.assign(this.bar.style, { left: '114px', top: '700px', height: '4px', width: '0px', background: C.akzent });
    const foot = (this.foot = el('div', 'abs', r));
    Object.assign(foot.style, { left: '112px', top: '936px', width: '1696px' });
    const fi = el('div', '', foot);
    Object.assign(fi.style, { borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--head)', fontSize: '19px', color: C.hell });
    el('span', '', fi, '<b style="font-weight:600;color:#fff">ip³ Energietechnik GmbH</b> · Theisseil');
    el('span', '', fi, 'info@ip3-energie.de · www.ip3-energie.de');
  }

  update(t, info) {
    // Abschlussbotschaft über dem 3D-Bild
    this.msg.update(t, 81.3, 84.75, { ins: [81.3, 83.4] });
    // Bogen zeichnet sich, der Punkt läuft an der Spitze mit
    const arcOn = t > 82.4 && t < 85.4;
    this.arcSvg.style.display = arcOn ? 'block' : 'none';
    let tip = [Z_DOT[0], Z_DOT[1]];
    if (arcOn) {
      if (!this.arcLen) { this.arcLen = this.arc.getTotalLength(); this.arc.style.strokeDasharray = `${this.arcLen} ${this.arcLen}`; }
      const f = ease.inOutSine(prog(82.6, 84.45, t));
      this.arc.style.strokeDashoffset = String(this.arcLen * (1 - f));
      const p = this.arc.getPointAtLength(this.arcLen * f); tip = [p.x, p.y];
      const fo = 1 - ease.inOutSine(prog(84.5, 85.1, t));
      this.arc.style.opacity = String(fo); this.arcBase.style.opacity = String(fo * prog(82.5, 83.0, t));
    }
    const on = t > 82.55;
    this.root.style.display = on ? 'block' : 'none';
    if (!on) return;
    this.bg.style.opacity = String(ease.inOutSine(prog(84.45, 85.1, t)));
    // Punkt: Spitze des Bogens -> Sonnenpunkt des Zeichens 3
    const k = ease.inOutCubic(prog(84.45, 85.45, t));
    const x = tip[0], y = tip[1];
    const rad = lerp(9, Z_DOT_R, k);
    const col = `rgb(${Math.round(lerp(200, 141, k))},${Math.round(lerp(60, 12, k))},${Math.round(lerp(48, 7, k))})`;
    const sv = prog(82.6, 82.8, t) * (1 - prog(85.5, 85.75, t));
    Object.assign(this.sun.style, { left: x - rad + 'px', top: y - rad + 'px', width: 2 * rad + 'px', height: 2 * rad + 'px', background: col,
      boxShadow: `0 0 ${lerp(26, 40, k)}px ${lerp(8, 12, k)}px rgba(200,60,48,${lerp(0.45, 0.25, k)})`, opacity: String(sv) });
    this.zd.style.opacity = String(0.9 * prog(85.35, 85.7, t));
    this.z.style.opacity = String(0.2 * ease.inOutSine(prog(85.4, 86.4, t)));
    fadeEl(this.logo, t, 85.45, 99, 0.6, 0.1, 10);
    this.claim.update(t, 85.65, 99);
    this.cta.update(t, 85.95, 99);
    fadeEl(this.url, t, 86.7, 99, 0.5, 0.1, 10);
    this.bar.style.width = `${lerp(0, this.url.getBoundingClientRect().width || 380, ease.inOutCubic(prog(87.0, 87.7, t)))}px`;
    fadeEl(this.foot, t, 87.2, 99, 0.6, 0.1, 0);
  }
}
