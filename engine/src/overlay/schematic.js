import { el, svgEl, C, fadeEl, prog, ease, clamp, lerp, prepDraw, draw } from './base.js';

// Szene 2: Schematische Darstellung des Schaltschranks mit den vorhandenen Datenquellen
// und dem ip³ Rechner. Übergang aus der 3D-Station (Konturen morphen zum Schrank) und
// Übergang in das Dashboard (Rechner-Kasten wächst zum Dashboard-Rahmen).

const CAB = { x: 1066, y: 214, w: 372, h: 602 };
const DEV = {
  ctrl: { x: 1096, y: 262, w: 236, h: 70, label: 'Übergeordnete Steuerung', ly: 297, t: 15.2 },
  rtu: { x: 1096, y: 392, w: 176, h: 70, label: 'Fernwirktechnik', ly: 427, t: 15.8 },
  log: { x: 1096, y: 522, w: 140, h: 70, label: 'Datenlogger', ly: 557, t: 16.8 },
  ipc: { x: 1096, y: 652, w: 210, h: 92, label: 'ip³ Rechner', ly: 698, t: 15.3 },
};
const SENS = { x: 892, y: 420 };
const T_SENS = 17.85;
export const DASH_RECT = { x: 704, y: 120, w: 1120, h: 780 };

export class Schematic {
  constructor(root) {
    this.root = el('div', 'abs', root);
    Object.assign(this.root.style, { inset: '0' });
    const svg = (this.svg = svgEl('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080' }, this.root));
    svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0'; svg.style.overflow = 'visible';
    const g = (this.g = svgEl('g', {}, svg));
    const W = 'rgba(255,255,255,0.92)', W2 = 'rgba(255,255,255,0.35)';

    // Stationskontur aus 3D (wird pro Bild gesetzt) -> Schrankumriss
    this.morph = svgEl('path', { fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
    this.morph2 = svgEl('path', { fill: 'none', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': 1.5 }, svg);

    // Schrank
    this.cab = svgEl('rect', { x: CAB.x, y: CAB.y, width: CAB.w, height: CAB.h, rx: 8, fill: 'rgba(255,255,255,0.03)', stroke: W, 'stroke-width': 2 }, g);
    this.plate = svgEl('rect', { x: CAB.x + 16, y: CAB.y + 18, width: CAB.w - 32, height: CAB.h - 36, rx: 3, fill: 'none', stroke: W2, 'stroke-width': 1 }, g);
    this.rails = [254, 384, 514, 644].map((y) => svgEl('line', { x1: CAB.x + 24, y1: y + 8, x2: CAB.x + CAB.w - 24, y2: y + 8, stroke: 'rgba(255,255,255,0.22)', 'stroke-width': 10 }, g));
    // Kabelkanal rechts
    this.duct = svgEl('rect', { x: CAB.x + CAB.w - 58, y: CAB.y + 40, width: 26, height: CAB.h - 80, fill: 'none', stroke: W2, 'stroke-width': 1, 'stroke-dasharray': '3 5' }, g);

    this.devs = {};
    for (const [k, d] of Object.entries(DEV)) {
      const grp = svgEl('g', {}, g);
      const box = svgEl('rect', { x: d.x, y: d.y, width: d.w, height: d.h, rx: 5, fill: k === 'ipc' ? 'rgba(200,60,48,0.10)' : 'rgba(255,255,255,0.05)', stroke: k === 'ipc' ? C.akzent : W, 'stroke-width': k === 'ipc' ? 2.2 : 1.6 }, grp);
      // Klemmen oben und unten
      for (let i = 0; i < Math.floor(d.w / 18); i++) {
        svgEl('rect', { x: d.x + 9 + i * 18, y: d.y + 6, width: 9, height: 7, fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1 }, grp);
        svgEl('rect', { x: d.x + 9 + i * 18, y: d.y + d.h - 13, width: 9, height: 7, fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1 }, grp);
      }
      const led = svgEl('circle', { cx: d.x + d.w - 16, cy: d.y + d.h / 2, r: k === 'ipc' ? 6 : 3.5, fill: k === 'ipc' ? C.akzent : 'rgba(255,255,255,0.8)' }, grp);
      if (k === 'ipc') {
        // Display-Andeutung
        svgEl('rect', { x: d.x + 16, y: d.y + 26, width: 92, height: 44, rx: 3, fill: 'none', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': 1.2 }, grp);
        svgEl('polyline', { points: `${d.x + 22},${d.y + 60} ${d.x + 40},${d.y + 50} ${d.x + 56},${d.y + 54} ${d.x + 74},${d.y + 38} ${d.x + 100},${d.y + 44}`, fill: 'none', stroke: C.akzent, 'stroke-width': 1.6 }, grp);
      }
      // Beschriftung mit Führungslinie
      const lx = CAB.x + CAB.w + 44;
      const lead = svgEl('path', { d: `M${d.x + d.w} ${d.y + d.h / 2} L${CAB.x + CAB.w + 30} ${d.ly}`, fill: 'none', stroke: 'rgba(255,255,255,0.6)', 'stroke-width': 1.2 }, svg);
      const ldot = svgEl('circle', { cx: CAB.x + CAB.w + 30, cy: d.ly, r: 3.2, fill: '#fff' }, svg);
      const label = el('div', 'abs', this.root, k === 'ipc' ? 'ip<sup style="font-size:.6em;line-height:0">3</sup> Rechner' : d.label);
      Object.assign(label.style, { left: lx + 'px', top: d.ly - 15 + 'px', fontFamily: 'var(--zahl)', fontWeight: 500, fontSize: '22px', color: k === 'ipc' ? '#fff' : C.hell, whiteSpace: 'nowrap' });
      if (k === 'ipc') label.style.fontWeight = 700;
      this.devs[k] = { d, grp, box, led, lead, ldot, label };
      prepDraw(lead);
    }

    // Einstrahlungssensor außen
    const sg = (this.sens = svgEl('g', {}, g));
    const sx = SENS.x, sy = SENS.y;
    svgEl('line', { x1: sx, y1: sy + 18, x2: sx, y2: sy + 120, stroke: W, 'stroke-width': 2 }, sg);
    svgEl('ellipse', { cx: sx, cy: sy + 16, rx: 40, ry: 8, fill: 'none', stroke: W, 'stroke-width': 1.8 }, sg);
    svgEl('rect', { x: sx - 22, y: sy - 2, width: 44, height: 16, rx: 3, fill: 'none', stroke: W, 'stroke-width': 1.8 }, sg);
    svgEl('path', { d: `M${sx - 15} ${sy - 2} A15 15 0 0 1 ${sx + 15} ${sy - 2}`, fill: 'rgba(255,255,255,0.08)', stroke: W, 'stroke-width': 1.8 }, sg);
    const sLabel = (this.sLabel = el('div', 'abs', this.root, 'Einstrahlungssensor'));
    Object.assign(sLabel.style, { left: sx - 130 + 'px', top: sy - 96 + 'px', width: '260px', textAlign: 'center', fontFamily: 'var(--zahl)', fontWeight: 500, fontSize: '22px', color: C.hell });
    const sVal = (this.sVal = el('div', 'abs num', this.root, '913&nbsp;W/m²'));
    Object.assign(sVal.style, { left: sx - 110 + 'px', top: sy - 58 + 'px', width: '220px', textAlign: 'center', fontFamily: 'var(--zahl)', fontWeight: 700, fontSize: '22px', color: '#fff' });

    // Datenleitungen zum Rechner (weiß, mit laufenden Paketen)
    const ipc = DEV.ipc, ix = ipc.x + ipc.w / 2, iy = ipc.y;
    const duct = CAB.x + CAB.w - 45;
    const wy = (dv) => dv.y + dv.h + 16;
    this.wires = {
      ctrl: `M${DEV.ctrl.x + 30} ${DEV.ctrl.y + DEV.ctrl.h} L${DEV.ctrl.x + 30} ${wy(DEV.ctrl)} L${duct - 6} ${wy(DEV.ctrl)} L${duct - 6} ${iy - 26} L${ix + 20} ${iy - 26} L${ix + 20} ${iy}`,
      rtu: `M${DEV.rtu.x + 30} ${DEV.rtu.y + DEV.rtu.h} L${DEV.rtu.x + 30} ${wy(DEV.rtu)} L${duct} ${wy(DEV.rtu)} L${duct} ${iy - 18} L${ix + 40} ${iy - 18} L${ix + 40} ${iy}`,
      log: `M${DEV.log.x + 30} ${DEV.log.y + DEV.log.h} L${DEV.log.x + 30} ${wy(DEV.log)} L${duct + 6} ${wy(DEV.log)} L${duct + 6} ${iy - 10} L${ix + 60} ${iy - 10} L${ix + 60} ${iy}`,
      sens: `M${sx} ${sy + 120} L${sx} ${CAB.y + CAB.h - 46} L${ipc.x - 16} ${CAB.y + CAB.h - 46} L${ipc.x - 16} ${ipc.y + 46} L${ipc.x} ${ipc.y + 46}`,
    };
    this.wireEls = {};
    for (const [k, dd] of Object.entries(this.wires)) {
      const base = svgEl('path', { d: dd, fill: 'none', stroke: 'rgba(255,255,255,0.75)', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
      const flow = svgEl('path', { d: dd, fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': '2 22' }, g);
      prepDraw(base);
      this.wireEls[k] = { base, flow };
    }
    // Leitmotiv-Punkt (aus 3D übernommen)
    this.dot = svgEl('circle', { r: 7, fill: C.akzent }, svg);
    this.dotGlow = svgEl('circle', { r: 22, fill: 'rgba(200,60,48,0.25)' }, svg);
    this.box = svgEl('rect', { fill: 'none', stroke: C.akzent, 'stroke-width': 2.2, rx: 5 }, svg);
  }

  // info: Bildschirmprojektion der 3D-Station (aus dem Director, nur bis ca. 15,5 s)
  update(t, info) {
    const on = t > 14.45 && t < 21.6;
    this.root.style.display = on ? 'block' : 'none';
    if (!on) return;

    // 1) Morph der Stationskontur (Frontfläche) zum Schrankumriss
    const m = ease.inOutCubic(prog(14.6, 15.35, t));
    const front = info && info.stationFront;
    if (front && t < 15.6) {
      const tgt = [[CAB.x, CAB.y], [CAB.x + CAB.w, CAB.y], [CAB.x + CAB.w, CAB.y + CAB.h], [CAB.x, CAB.y + CAB.h]];
      const pts = front.map((p, i) => [lerp(p[0], tgt[i][0], m), lerp(p[1], tgt[i][1], m)]);
      this.morph.setAttribute('d', 'M' + pts.map((p) => p.join(' ')).join(' L') + ' Z');
      this.morph.style.opacity = String(Math.min(1, prog(14.45, 14.7, t)) * (1 - prog(15.3, 15.5, t)));
      if (info.stationBack) {
        const bp = info.stationBack.map((p, i) => [lerp(p[0], tgt[i][0], m), lerp(p[1], tgt[i][1], m)]);
        let dd = 'M' + bp.map((p) => p.join(' ')).join(' L') + ' Z';
        for (let i = 0; i < 4; i++) dd += ` M${pts[i].join(' ')} L${bp[i].join(' ')}`;
        this.morph2.setAttribute('d', dd);
        this.morph2.style.opacity = String(Math.min(1, prog(14.45, 14.7, t)) * (1 - m));
      }
    } else { this.morph.style.opacity = '0'; this.morph2.style.opacity = '0'; }

    // 2) Schrank und Geräte
    const cabIn = prog(15.2, 15.45, t);
    const out = ease.inOutCubic(prog(20.25, 21.0, t)); // Ausblendung beim Übergang ins Dashboard
    this.cab.style.opacity = String(cabIn * (1 - out));
    this.plate.style.opacity = String(ease.outCubic(prog(15.25, 15.7, t)) * (1 - out));
    this.duct.style.opacity = String(ease.outCubic(prog(15.35, 15.8, t)) * (1 - out));
    this.rails.forEach((r, i) => (r.style.opacity = String(ease.outCubic(prog(15.3 + i * 0.08, 15.7 + i * 0.08, t)) * (1 - out))));
    for (const [k, v] of Object.entries(this.devs)) {
      const a = v.d.t;
      const pin = ease.outCubic(prog(a, a + 0.45, t));
      const hl = Math.exp(-Math.max(0, t - a) * 1.6) * (t >= a ? 1 : 0); // kurzes Aufleuchten
      v.grp.style.opacity = String(Math.max(0.0, pin) * (1 - out) * (k === 'ipc' ? 1 : 1));
      v.grp.style.transform = `translateY(${(1 - pin) * 10}px)`;
      v.box.setAttribute('fill', k === 'ipc' ? `rgba(200,60,48,${0.1 + 0.15 * hl})` : `rgba(255,255,255,${0.05 + 0.16 * hl})`);
      draw(v.lead, ease.inOutCubic(prog(a + 0.1, a + 0.55, t)));
      v.lead.style.opacity = String(1 - out);
      v.ldot.style.opacity = String(prog(a + 0.45, a + 0.6, t) * (1 - out));
      fadeEl(v.label, t, a + 0.25, 20.6, 0.4, 0.35, 0);
    }
    // Sensor
    const sp = ease.outCubic(prog(T_SENS, T_SENS + 0.5, t));
    this.sens.style.opacity = String(sp * (1 - out));
    this.sens.style.transform = `translateY(${(1 - sp) * 10}px)`;
    fadeEl(this.sLabel, t, T_SENS + 0.2, 20.6, 0.4, 0.35, 0);
    fadeEl(this.sVal, t, T_SENS + 0.45, 20.6, 0.4, 0.35, 0);

    // 3) Leitungen zeichnen und Datenpakete laufen lassen
    const starts = { ctrl: DEV.ctrl.t + 0.3, rtu: DEV.rtu.t + 0.3, log: DEV.log.t + 0.3, sens: T_SENS + 0.35 };
    for (const [k, w] of Object.entries(this.wireEls)) {
      const a = starts[k];
      draw(w.base, ease.inOutCubic(prog(a, a + 0.8, t)));
      w.base.style.opacity = String(1 - out);
      const fl = prog(a + 0.7, a + 1.0, t) * (1 - out);
      w.flow.style.opacity = String(fl);
      // schneller zum Bündeln, sonst ruhiger Fluss
      const speed = 70 + 120 * ease.inOutSine(prog(19.8, 20.4, t));
      w.flow.style.strokeDashoffset = String(-(t * speed) % 24);
    }

    // 4) Leitmotiv-Punkt: aus 3D-Position zum Rechner, dann Rechner -> Dashboard-Rahmen
    const ipc = DEV.ipc;
    const target = [ipc.x + ipc.w - 16, ipc.y + ipc.h / 2];
    const src = info && info.stationDot ? info.stationDot : target;
    const k = ease.inOutCubic(prog(14.6, 15.35, t));
    const dx = lerp(src[0], target[0], k), dy = lerp(src[1], target[1], k);
    const dvis = t < 20.4;
    this.dot.setAttribute('cx', dx); this.dot.setAttribute('cy', dy);
    this.dotGlow.setAttribute('cx', dx); this.dotGlow.setAttribute('cy', dy);
    const pulse = 1 + 0.25 * Math.sin(t * 6.0) * prog(19.8, 20.0, t);
    this.dotGlow.setAttribute('r', String(22 * pulse));
    this.dot.style.opacity = this.dotGlow.style.opacity = String(dvis ? 1 - prog(20.1, 20.4, t) : 0);

    // Rechner-Kasten wächst zum Dashboard-Rahmen
    const g = ease.inOutQuint(prog(20.3, 21.25, t));
    const R = { x: lerp(ipc.x, DASH_RECT.x, g), y: lerp(ipc.y, DASH_RECT.y, g), w: lerp(ipc.w, DASH_RECT.w, g), h: lerp(ipc.h, DASH_RECT.h, g) };
    this.box.setAttribute('x', R.x); this.box.setAttribute('y', R.y); this.box.setAttribute('width', R.w); this.box.setAttribute('height', R.h);
    this.box.setAttribute('rx', String(lerp(5, 16, g)));
    this.box.setAttribute('stroke', g > 0.5 ? 'rgba(255,255,255,0.14)' : C.akzent);
    this.box.setAttribute('stroke-width', String(lerp(2.2, 1, g)));
    this.box.style.opacity = String(t > 20.3 ? 1 - prog(21.3, 21.5, t) : 0);
  }
}
