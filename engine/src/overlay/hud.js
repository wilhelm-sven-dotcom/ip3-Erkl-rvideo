import { el, svgEl, C, fadeEl, prog, ease, clamp, lerp } from './base.js';
import { fmt, vnoise } from '../util.js';
import { irr, pMoeglich } from '../data.js';

// Szene 1: Messwertanzeige über dem Luftbild. Einstrahlung bleibt, Wirkleistung fällt.

const T_DROP0 = 2.55, T_DROP1 = 4.4;
const G0 = irr(11.5), P0 = pMoeglich(11.5);

export function hudPower(t) {
  const k = ease.inOutCubic(prog(T_DROP0, T_DROP1, t));
  return Math.max(0, lerp(P0 + 0.04 * vnoise(t * 1.7, 3), 0, k));
}
export function hudIrr(t) { return G0 + 2.2 * vnoise(t * 1.3, 7); }

export class Hud {
  constructor(root) {
    const card = (this.card = el('div', 'abs', root));
    Object.assign(card.style, { left: '1376px', top: '92px', width: '448px', padding: '20px 26px 22px', boxSizing: 'border-box',
      background: 'rgba(12,26,61,0.78)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '14px' });
    const tag = el('div', '', card, 'Beispieldaten · Beispieltag 11:30 Uhr');
    Object.assign(tag.style, { fontFamily: 'var(--zahl)', fontWeight: 500, fontSize: '13px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(232,231,239,0.55)', marginBottom: '14px' });
    const row = (label, unit, color) => {
      const r = el('div', '', card);
      Object.assign(r.style, { position: 'relative', height: '118px' });
      const l = el('div', 'abs', r, label);
      Object.assign(l.style, { left: 0, top: '4px', fontFamily: 'var(--zahl)', fontWeight: 500, fontSize: '15px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(232,231,239,0.72)' });
      const v = el('div', 'abs num', r);
      Object.assign(v.style, { right: 0, top: '-6px', fontFamily: 'var(--zahl)', fontWeight: 700, fontSize: '40px', color: '#fff', letterSpacing: '-0.01em' });
      const svg = svgEl('svg', { width: 396, height: 50, viewBox: '0 0 396 50' }, r);
      Object.assign(svg.style, { position: 'absolute', left: 0, top: '56px', overflow: 'visible' });
      svgEl('line', { x1: 0, y1: 49.5, x2: 396, y2: 49.5, stroke: 'rgba(255,255,255,0.14)', 'stroke-width': 1 }, svg);
      const path = svgEl('path', { fill: 'none', stroke: color, 'stroke-width': 2.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      const dot = svgEl('circle', { r: 4.5, fill: C.akzent }, svg);
      return { v, path, dot, unit };
    };
    this.g = row('Einstrahlung', 'W/m²', C.lav);
    this.p = row('Wirkleistung', 'MW', '#ffffff');
  }

  update(t) {
    const o = fadeEl(this.card, t, 0.7, 9.0, 0.6, 0.45, 14);
    if (o <= 0) return;
    // Verlauf: Zeitfenster der letzten 6 s, rechts = jetzt
    const N = 90, span = 6.0;
    const ptsG = [], ptsP = [];
    for (let i = 0; i <= N; i++) {
      const tt = t - span + (span * i) / N;
      const x = (396 * i) / N;
      ptsG.push([x, 50 - (hudIrr(tt) / 1000) * 34]);
      ptsP.push([x, 50 - (hudPower(tt) / 9.0) * 46]);
    }
    const d = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
    this.g.path.setAttribute('d', d(ptsG));
    this.p.path.setAttribute('d', d(ptsP));
    this.g.dot.setAttribute('cx', 396); this.g.dot.setAttribute('cy', ptsG[N][1]); this.g.dot.style.display = 'none';
    // roter Punkt markiert den Beginn des Leistungsabfalls
    const xd = 396 - ((t - T_DROP0) / span) * 396;
    const dv = t > T_DROP0 && xd > -4;
    this.p.dot.style.display = dv ? 'block' : 'none';
    if (dv) { this.p.dot.setAttribute('cx', xd.toFixed(1)); this.p.dot.setAttribute('cy', (50 - (P0 / 9) * 46).toFixed(1)); }
    this.g.v.innerHTML = `${fmt(hudIrr(t), 0)}<span style="font-size:20px;font-weight:500;color:rgba(232,231,239,.75)">&nbsp;W/m²</span>`;
    this.p.v.innerHTML = `${fmt(hudPower(t), 1)}<span style="font-size:20px;font-weight:500;color:rgba(232,231,239,.75)">&nbsp;MW</span>`;
  }
}
