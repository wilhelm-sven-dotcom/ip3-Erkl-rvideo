import { el, C, fadeEl, prog, ease, clamp, lerp } from './base.js';
import { Headlines } from './headlines.js';
import { Hud } from './hud.js';
import { Schematic } from './schematic.js';
import { Dashboard } from './dashboard.js';
import { EndCard } from './endcard.js';

// Alle 2D-Ebenen in fester Stapelreihenfolge.

export class Overlay {
  constructor(root) {
    this.root = root;
    this.schematic = new Schematic(root);
    this.dash = new Dashboard(root);
    this.hud = new Hud(root);
    // 3D-verankerte Beschriftung des Speicher-Planungsszenarios
    const b = (this.bess = el('div', 'abs', root));
    Object.assign(b.style, { left: 0, top: 0, width: '0', height: '0' });
    this.bessLine = el('div', 'abs', b); Object.assign(this.bessLine.style, { width: '1.5px', background: 'rgba(255,255,255,0.85)', left: 0, top: 0 });
    this.bessDot = el('div', 'abs', b); Object.assign(this.bessDot.style, { width: '12px', height: '12px', borderRadius: '50%', background: C.akzent, left: 0, top: 0 });
    this.bessText = el('div', 'abs', b, `<div style="font-family:var(--zahl);font-weight:500;font-size:15px;letter-spacing:.16em;text-transform:uppercase;color:${C.akzent}">Planungsszenario</div><div style="font-family:var(--head);font-weight:800;font-size:30px;letter-spacing:-.01em;color:#fff;margin-top:4px">Graustromspeicher</div><div style="font-family:var(--zahl);font-weight:500;font-size:14px;color:rgba(232,231,239,.75);margin-top:6px">schematisch · Lage und Größe beispielhaft</div>`);
    Object.assign(this.bessText.style, { whiteSpace: 'nowrap', padding: '14px 18px', background: 'rgba(12,26,61,0.72)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '10px' });
    this.headlines = new Headlines(root);
    this.end = new EndCard(root);
    // Kennzeichnung oben rechts
    const tag = (this.tag = el('div', 'abs', root, 'Schematische Darstellung · Beispieldaten'));
    Object.assign(tag.style, { right: '96px', top: '58px', fontFamily: 'var(--zahl)', fontWeight: 500, fontSize: '14px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(232,231,239,0.6)' });
    this.headlines.layout();
  }

  update(t, info) {
    this.hud.update(t);
    this.schematic.update(t, info);
    this.dash.update(t, info && info.planRect);
    this.headlines.update(t);
    this.end.update(t, info);
    fadeEl(this.tag, t, 15.4, 70.45, 0.5, 0.35, 0);
    // Speicher-Label
    const on = t > 76.4 && t < 80.2 && info && info.bessScreen;
    this.bess.style.display = on ? 'block' : 'none';
    if (on) {
      const [x, y] = info.bessScreen;
      const o = prog(76.6, 77.1, t) * (1 - prog(79.75, 80.1, t));
      const lh = 150 * ease.outCubic(prog(76.6, 77.2, t));
      Object.assign(this.bessDot.style, { left: x - 6 + 'px', top: y - 6 + 'px', opacity: String(o) });
      Object.assign(this.bessLine.style, { left: x - 0.75 + 'px', top: y - lh + 'px', height: lh + 'px', opacity: String(o) });
      Object.assign(this.bessText.style, { left: x - 20 + 'px', top: y - 150 - 108 + 'px', opacity: String(o * prog(76.9, 77.3, t)) });
    }
  }
}
