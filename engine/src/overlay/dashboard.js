import { el, svgEl, C, fadeEl, prog, ease, clamp, lerp, prepDraw, draw } from './base.js';
import { fmt } from '../util.js';
import { PARK, EVENTS, irr, pMoeglich, pIst, vorgabe, E_MOEGLICH, E_IST, E_DV, E_RD, E_ENTGANGEN, MONAT, H0, H1 } from '../data.js';
import { FENCE, FIELD, tables, TABLE, STATION, SENSOR, colX, ROADS, GATE } from '../world/layout.js';
import { DASH_RECT } from './schematic.js';

// Schematisches Dashboard (Szenen 2 bis 6). Alle Werte sind Beispieldaten aus data.js.

const R = DASH_RECT;
const PX0 = 96, PX1 = 1072, PY0 = 140, PY1 = 432;
const xh = (h) => PX0 + ((h - H0) / (H1 - H0)) * (PX1 - PX0);
const yP = (mw) => PY1 - (mw / 9) * (PY1 - PY0);
const TABS = ['Übersicht', 'Regelung', 'Ertrag', 'Abrechnung', 'Anlage'];
const TAB_T = [21.0, 22.65, 37.6, 52.65, 65.2];
const T_ON = 20.9, T_OFF = 71.4;

function pathFrom(f, a = H0, b = H1, n = 640) {
  let d = '';
  for (let i = 0; i <= n; i++) { const h = a + ((b - a) * i) / n; d += (i ? ' L' : 'M') + xh(h).toFixed(1) + ' ' + yP(f(h)).toFixed(1); }
  return d;
}
function stepPath(f, a = H0, b = H1) {
  // Treppenfunktion der Vorgabe (MW-Deckel)
  const brk = [a, ...EVENTS.flatMap((e) => [e.von, e.bis]), b].sort((x, y) => x - y);
  let d = '';
  for (let i = 0; i < brk.length - 1; i++) {
    const h0 = brk[i], h1 = brk[i + 1], v = f((h0 + h1) / 2);
    d += (i ? ' L' : 'M') + xh(h0).toFixed(1) + ' ' + yP(v).toFixed(1) + ' L' + xh(h1).toFixed(1) + ' ' + yP(v).toFixed(1);
  }
  return d;
}
const capMW = (h) => (vorgabe(h) / 100) * PARK.pAV;

function txt(parent, html, x, y, st = {}) {
  const e = el('div', 'abs', parent, html);
  Object.assign(e.style, { left: x + 'px', top: y + 'px', whiteSpace: 'nowrap', ...st });
  return e;
}
const SG = (size, w = 500, col = C.hell, extra = {}) => ({ fontFamily: 'var(--zahl)', fontWeight: w, fontSize: size + 'px', color: col, ...extra });
const LF = (size, w = 400, col = '#fff', extra = {}) => ({ fontFamily: 'var(--head)', fontWeight: w, fontSize: size + 'px', color: col, ...extra });
const CAPS = { textTransform: 'uppercase', letterSpacing: '0.14em' };

export class Dashboard {
  constructor(root) {
    const P = (this.panel = el('div', 'abs', root));
    Object.assign(P.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
    const frame = (this.frame = el('div', 'abs', P));
    Object.assign(frame.style, { inset: 0, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.035)' });

    // Kopfzeile
    const head = (this.head = el('div', 'abs', P));
    Object.assign(head.style, { left: 0, top: 0, width: R.w + 'px', height: '68px', borderBottom: '1px solid rgba(255,255,255,0.10)' });
    const logo = el('img', 'abs', head); logo.src = 'assets/brand/ip3-marke-weiss.svg';
    Object.assign(logo.style, { left: '28px', top: '20px', height: '28px' });
    const div = el('div', 'abs', head); Object.assign(div.style, { left: '82px', top: '20px', width: '1px', height: '28px', background: 'rgba(255,255,255,0.25)' });
    txt(head, 'Beispielpark', 98, 15, LF(19, 600));
    txt(head, 'Freifläche · 9,8&nbsp;MWp', 98, 40, SG(13, 500, C.sec));
    this.tabs = TABS.map((name, i) => txt(head, name, 0, 26, SG(15, 500, '#fff', { letterSpacing: '0.02em' })));
    // rechtsbündig mit gleichmäßigem Abstand anordnen
    const widths = this.tabs.map((tl) => tl.getBoundingClientRect().width || 80);
    let x = R.w - 32 - widths.reduce((a, b) => a + b, 0) - 34 * (TABS.length - 1);
    this.tabX = []; this.tabW = widths;
    this.tabs.forEach((tl, i) => { tl.style.left = x + 'px'; this.tabX.push(x); x += widths[i] + 34; });
    this.tabLine = el('div', 'abs', head);
    Object.assign(this.tabLine.style, { top: '64px', height: '3px', background: C.akzent, borderRadius: '2px' });

    // Inhaltsebene mit SVG für Diagramme
    const body = (this.body = el('div', 'abs', P));
    Object.assign(body.style, { left: 0, top: 0, width: R.w + 'px', height: R.h + 'px' });
    const svg = (this.svg = svgEl('svg', { width: R.w, height: R.h, viewBox: `0 0 ${R.w} ${R.h}` }, body));
    svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0'; svg.style.overflow = 'visible';
    const defs = svgEl('defs', {}, svg);
    const clip = (id) => { const c = svgEl('clipPath', { id }, defs); return svgEl('rect', { x: PX0 - 2, y: 0, width: 0, height: R.h }, c); };
    this.clipIst = clip('cIst'); this.clipCap = clip('cCap'); this.clipMoeg = clip('cMoeg'); this.clipIrr = clip('cIrr');
    const hatch = svgEl('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    svgEl('rect', { width: 7, height: 7, fill: 'rgba(200,60,48,0.34)' }, hatch);
    svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: 'rgba(232,164,156,0.55)', 'stroke-width': 1.6 }, hatch);

    this.buildOverview();
    this.buildChart();
    this.buildLanes();
    this.buildYield();
    this.buildBilling();
    this.buildPlant();
  }

  // ---------------- Übersicht ----------------
  buildOverview() {
    const g = (this.ov = el('div', 'abs', this.body)); Object.assign(g.style, { left: 0, top: 0, width: R.w + 'px', height: R.h + 'px' });
    const tiles = [
      ['Wirkleistung', '0,0', 'MW', 'Netzverknüpfungspunkt'],
      ['Einstrahlung', '913', 'W/m²', 'Modulebene'],
      ['Steuerungsvorgabe', '0', '%', 'aktive Vorgabe', true],
      ['Datenquellen', '4/4', '', 'verbunden'],
    ];
    this.ovTiles = tiles.map(([l, v, u, s, red], i) => {
      const x = 32 + i * 268;
      const tl = el('div', 'abs', g);
      Object.assign(tl.style, { left: x + 'px', top: '92px', width: '252px', height: '118px', boxSizing: 'border-box', padding: '16px 18px', background: 'rgba(255,255,255,0.04)', borderTop: `3px solid ${red ? C.akzent : 'rgba(255,255,255,0.25)'}`, borderRadius: '4px' });
      txt(tl, l, 18, 14, SG(13, 500, C.sec, CAPS));
      txt(tl, `${v}<span style="font-size:18px;font-weight:500;color:${C.sec}">${u ? '&nbsp;' + u : ''}</span>`, 18, 36, SG(36, 700, '#fff'));
      txt(tl, s, 18, 84, SG(13, 500, 'rgba(232,231,239,0.5)'));
      return tl;
    });
    const st = (this.ovStatus = el('div', 'abs', g)); Object.assign(st.style, { left: '32px', top: '242px', width: '1056px' });
    txt(st, 'Datenquellen', 0, 0, SG(13, 500, C.sec, CAPS));
    this.ovRows = ['Übergeordnete Steuerung', 'Fernwirktechnik', 'Datenlogger', 'Einstrahlungssensor'].map((n, i) => {
      const r = el('div', 'abs', st); Object.assign(r.style, { left: 0, top: 30 + i * 58 + 'px', width: '1056px', height: '50px', borderTop: '1px solid rgba(255,255,255,0.1)' });
      txt(r, n, 0, 14, LF(19, 600));
      txt(r, '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#fff;margin-right:10px;vertical-align:1px"></span>verbunden', 520, 15, SG(16, 500, C.hell));
      txt(r, 'Aktualisierung laufend', 820, 15, SG(16, 500, 'rgba(232,231,239,0.5)'));
      return r;
    });
  }

  // ---------------- Tagesdiagramm (Szenen 2 bis 4) ----------------
  buildChart() {
    const s = this.svg;
    const g = (this.chart = svgEl('g', {}, s));
    this.grid = [];
    for (let mw = 0; mw <= 9; mw += 3) {
      const ln = svgEl('line', { x1: PX0, y1: yP(mw), x2: PX1, y2: yP(mw), stroke: mw === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.09)', 'stroke-width': 1 }, g);
      this.grid.push(ln);
    }
    this.axisLabels = el('div', 'abs', this.body); Object.assign(this.axisLabels.style, { left: 0, top: 0 });
    for (let mw = 0; mw <= 9; mw += 3) txt(this.axisLabels, `${mw}`, PX0 - 44, yP(mw) - 9, SG(13, 500, C.sec, { width: '30px', textAlign: 'right' }));
    txt(this.axisLabels, 'MW', PX0 - 6, PY0 - 30, SG(13, 500, C.sec));
    for (let h = 6; h <= 21; h += 3) txt(this.axisLabels, `${String(h).padStart(2, '0')}:00`, xh(h) - 22, PY1 + 10, SG(13, 500, C.sec));
    this.chartTitle = txt(this.body, 'Wirkleistung · Beispieltag', 32, 92, SG(14, 500, C.sec, CAPS));
    // Legende
    this.legend = el('div', 'abs', this.body); Object.assign(this.legend.style, { left: 0, top: 0 });
    const leg = (x, label, kind, col) => {
      const sv = svgEl('svg', { width: 34, height: 12 }, this.legend); Object.assign(sv.style, { position: 'absolute', left: x + 'px', top: '97px' });
      if (kind === 'line') svgEl('line', { x1: 0, y1: 6, x2: 34, y2: 6, stroke: col, 'stroke-width': 2.4 }, sv);
      else svgEl('line', { x1: 0, y1: 6, x2: 34, y2: 6, stroke: col, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, sv);
      return txt(this.legend, label, x + 42, 92, SG(14, 500, C.hell));
    };
    this.legIst = [leg(560, 'Tatsächliche Leistung', 'line', '#fff')];
    this.legCap = el('div', 'abs', this.legend); this.legCap.style.left = '0'; this.legCap.style.top = '0';
    {
      const sv = svgEl('svg', { width: 34, height: 12 }, this.legCap); Object.assign(sv.style, { position: 'absolute', left: '816px', top: '97px' });
      svgEl('line', { x1: 0, y1: 6, x2: 34, y2: 6, stroke: C.lav, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, sv);
      txt(this.legCap, 'Steuerungsvorgabe', 858, 92, SG(14, 500, C.hell));
    }
    this.legMoeg = el('div', 'abs', this.legend); this.legMoeg.style.left = '0'; this.legMoeg.style.top = '0';
    {
      const sv = svgEl('svg', { width: 34, height: 12 }, this.legMoeg); Object.assign(sv.style, { position: 'absolute', left: '780px', top: '97px' });
      svgEl('line', { x1: 0, y1: 6, x2: 34, y2: 6, stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '6 5' }, sv);
      txt(this.legMoeg, 'Mögliche Leistung <span style="color:#C83C30">(berechnet)</span>', 822, 92, SG(14, 500, C.hell));
    }

    // Flächen und Kurven
    const areaD = pathFrom(pIst) + ` L${xh(H1)} ${yP(0)} L${xh(H0)} ${yP(0)} Z`;
    this.areaIst = svgEl('path', { d: areaD, fill: 'rgba(47,36,130,0.55)', 'clip-path': 'url(#cIst)' }, g);
    // entgangene Energie: Fläche zwischen möglicher und tatsächlicher Leistung
    this.gaps = EVENTS.map((e) => {
      const top = pathFrom(pMoeglich, e.von, e.bis, 120);
      let bot = ''; for (let i = 120; i >= 0; i--) { const h = e.von + ((e.bis - e.von) * i) / 120; bot += ` L${xh(h).toFixed(1)} ${yP(pIst(h)).toFixed(1)}`; }
      return svgEl('path', { d: top + bot + ' Z', fill: 'url(#hatch)', stroke: 'none' }, g);
    });
    this.capLine = svgEl('path', { d: stepPath(capMW), fill: 'none', stroke: C.lav, 'stroke-width': 2, 'stroke-dasharray': '6 5', 'clip-path': 'url(#cCap)' }, g);
    this.moegLine = svgEl('path', { d: pathFrom(pMoeglich), fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-dasharray': '7 6', 'clip-path': 'url(#cMoeg)', opacity: 0.9 }, g);
    this.istLine = svgEl('path', { d: pathFrom(pIst), fill: 'none', stroke: '#fff', 'stroke-width': 2.8, 'stroke-linejoin': 'round', 'clip-path': 'url(#cIst)' }, g);
    // Leitmotiv-Punkte am Beginn der Eingriffe
    this.evDots = EVENTS.map((e) => svgEl('circle', { cx: xh(e.von), cy: yP(pMoeglich(e.von)), r: 6.5, fill: C.akzent }, g));
    this.headDot = svgEl('circle', { r: 5, fill: '#fff' }, g);
    // Energiewerte in den Flächen
    this.gapLabels = EVENTS.map((e, i) => {
      const hm = (e.von + e.bis) / 2;
      const v = i === 0 ? E_DV : E_RD;
      return txt(this.body, `${fmt(v, 1)}&nbsp;MWh`, xh(hm) - 50, (yP(pMoeglich(hm)) + yP(pIst(hm))) / 2 - (i === 0 ? 12 : 30), SG(17, 700, '#fff', { width: '100px', textAlign: 'center', textShadow: '0 0 6px rgba(12,26,61,0.9)' }));
    });
  }

  // ---------------- Spuren je Akteur (Szene 3) ----------------
  buildLanes() {
    const g = (this.lanes = svgEl('g', {}, this.svg));
    const h = (this.lanesH = el('div', 'abs', this.body)); h.style.left = '0'; h.style.top = '0';
    const lane = (i, e, col, label) => {
      const y = 492 + i * 64;
      const bg = svgEl('rect', { x: PX0, y: y + 22, width: PX1 - PX0, height: 24, rx: 3, fill: 'rgba(255,255,255,0.035)' }, g);
      const bar = svgEl('rect', { x: xh(e.von), y: y + 22, width: 0, height: 24, rx: 3, fill: col, opacity: 0.9 }, g);
      const lab = txt(h, label, PX0, y - 4, SG(15, 500, C.hell, CAPS));
      const val = i === 0
        ? txt(h, `Vorgabe ${e.vorgabe}&nbsp;%`, xh(e.von) - 172, y + 23, SG(17, 700, col, { width: '160px', textAlign: 'right' }))
        : txt(h, `Vorgabe ${e.vorgabe}&nbsp;%`, xh(e.bis) + 12, y + 23, SG(17, 700, col));
      const conn = svgEl('line', { x1: xh(e.von), y1: y + 22, x2: xh(e.von), y2: yP(pMoeglich(e.von)), stroke: col, 'stroke-width': 1.4, 'stroke-dasharray': '3 4' }, g);
      prepDraw(conn);
      return { bg, bar, lab, val, conn, e, col };
    };
    this.laneDV = lane(0, EVENTS[0], C.lav, 'Direktvermarkter');
    this.laneRD = lane(1, EVENTS[1], C.lachs, 'Netzbetreiber · Redispatch-Maßnahme');
    // Ereignisprotokoll
    const lg = (this.log = el('div', 'abs', this.body)); Object.assign(lg.style, { left: '32px', top: '636px', width: '1056px' });
    const cols = [0, 190, 470, 800];
    ['Zeitraum', 'Eingriff durch', 'Anlass', 'Vorgabe'].forEach((c, i) => txt(lg, c, cols[i], 0, SG(12, 500, 'rgba(232,231,239,0.5)', CAPS)));
    const row = (y, cells, col) => {
      const r = el('div', 'abs', lg); Object.assign(r.style, { left: 0, top: y + 'px', width: '1056px', height: '40px', borderTop: '1px solid rgba(255,255,255,0.1)' });
      cells.forEach((c, i) => txt(r, c, cols[i], 10, i === 1 ? SG(16, 700, col) : SG(16, 500, '#fff')));
      return r;
    };
    this.logRows = [
      row(24, ['11:30–14:00', 'Direktvermarkter', 'Vermarktungsbedingte Abregelung', '0&nbsp;%'], C.lav),
      row(66, ['15:00–17:00', 'Netzbetreiber', 'Redispatch-Maßnahme', '30&nbsp;%'], C.lachs),
    ];
  }

  // ---------------- Ertrag / entgangene Energie (Szene 4) ----------------
  buildYield() {
    const g = (this.irrG = svgEl('g', {}, this.svg));
    const y0 = 572, y1 = 498; // Streifen Einstrahlung
    const yI = (w) => y0 - (w / 1000) * (y0 - y1);
    let d = ''; for (let i = 0; i <= 400; i++) { const hh = H0 + ((H1 - H0) * i) / 400; d += (i ? ' L' : 'M') + xh(hh).toFixed(1) + ' ' + yI(irr(hh)).toFixed(1); }
    svgEl('line', { x1: PX0, y1: y0, x2: PX1, y2: y0, stroke: 'rgba(255,255,255,0.3)', 'stroke-width': 1 }, g);
    this.irrArea = svgEl('path', { d: d + ` L${xh(H1)} ${y0} L${xh(H0)} ${y0} Z`, fill: 'rgba(141,138,184,0.18)', 'clip-path': 'url(#cIrr)' }, g);
    this.irrLine = svgEl('path', { d, fill: 'none', stroke: C.lav, 'stroke-width': 2.2, 'clip-path': 'url(#cIrr)' }, g);
    this.irrDot = svgEl('circle', { r: 4.5, fill: C.lav }, g);
    this.yI = yI;
    const h = (this.yieldH = el('div', 'abs', this.body)); h.style.left = '0'; h.style.top = '0';
    this.irrLab = txt(h, 'Einstrahlung · Sensor im Park', PX0, 468, SG(14, 500, C.hell, CAPS));
    this.irrVal = txt(h, '', PX1 - 160, 466, SG(18, 700, '#fff', { width: '160px', textAlign: 'right' }));
    // Anlagendaten-Chip
    this.chip = txt(h, 'Anlagendaten&nbsp;&nbsp;<b style="color:#fff">9,8&nbsp;MWp · Süd · 20°</b>', PX0, 590, SG(15, 500, C.hell, { padding: '8px 14px', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '20px' }));
    this.calc = txt(h, '→&nbsp;&nbsp;Berechnung der möglichen Leistung', PX0 + 330, 598, SG(15, 500, C.hell));
    // Kennzahlen
    const tile = (i, label, val, red) => {
      const x = 32 + i * 352;
      const tl = el('div', 'abs', h);
      Object.assign(tl.style, { left: x + 'px', top: '600px', width: '336px', height: '140px', boxSizing: 'border-box', padding: '16px 20px', background: red ? 'rgba(200,60,48,0.10)' : 'rgba(255,255,255,0.04)', borderTop: `3px solid ${red ? C.akzent : 'rgba(255,255,255,0.25)'}`, borderRadius: '4px' });
      txt(tl, label, 20, 14, SG(13, 500, C.sec, CAPS));
      const v = txt(tl, val, 20, 40, SG(40, 700, '#fff'));
      return { tl, v };
    };
    this.tiles = [
      tile(0, 'Mögliche Erzeugung (berechnet)', ''),
      tile(1, 'Tatsächliche Erzeugung', ''),
      tile(2, 'Entgangene Energie', '', true),
    ];
    this.split = txt(this.tiles[2].tl, `davon Direktvermarkter ${fmt(E_DV, 1)}&nbsp;MWh<br>davon Netzbetreiber (Redispatch) ${fmt(E_RD, 1)}&nbsp;MWh`, 20, 92, SG(13, 500, C.hell, { lineHeight: 1.45 }));
  }

  // ---------------- Abrechnungsprüfung (Szene 5) ----------------
  buildBilling() {
    const h = (this.bill = el('div', 'abs', this.body)); Object.assign(h.style, { left: 0, top: 0, width: R.w + 'px', height: R.h + 'px' });
    txt(h, 'Abgleich mit Betriebsdaten · Mai 2026', 32, 92, SG(14, 500, C.sec, CAPS));
    const cols = [0, 222, 360, 486];
    const tb = (this.table = el('div', 'abs', h)); Object.assign(tb.style, { left: '32px', top: '132px', width: '600px' });
    ['Position', 'Abrechnung', 'Prüfwert', 'Status'].forEach((c, i) => txt(tb, c, cols[i], 0, SG(12, 500, 'rgba(232,231,239,0.5)', CAPS)));
    const rows = [MONAT.dv, MONAT.mp, MONAT.ae];
    this.billRows = rows.map((r, i) => {
      const y = 28 + i * 84;
      const row = el('div', 'abs', tb); Object.assign(row.style, { left: '-12px', top: y + 'px', width: '624px', height: '76px', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' });
      txt(row, r.position, 12, 12, LF(21, 600));
      txt(row, r.quelle, 12, 44, SG(13, 500, C.sec));
      const a = txt(row, r.abgerechnet, cols[1] + 12, 14, SG(18, 700, '#fff'));
      const b = txt(row, r.geprueft, cols[2] + 12, 14, SG(18, 700, '#fff'));
      const sv = svgEl('svg', { width: 90, height: 40 }, row); Object.assign(sv.style, { position: 'absolute', left: cols[3] + 12 + 'px', top: '10px', overflow: 'visible' });
      let mark;
      if (r.ok) { mark = svgEl('path', { d: 'M3 18 L12 27 L30 7', fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, sv); prepDraw(mark); }
      else { mark = svgEl('circle', { cx: 11, cy: 17, r: 8, fill: C.akzent }, sv); }
      const note = r.ok ? txt(row, 'plausibel', cols[3] + 50, 16, SG(15, 500, C.hell)) : txt(row, `Abweichung<br><b style="color:#fff">${r.abweichung}</b>`, cols[3] + 34, 6, SG(14, 500, '#E8A49C', { lineHeight: 1.35 }));
      row.style.width = '600px';
      return { row, a, b, mark, note, ok: r.ok };
    });
    this.devBox = el('div', 'abs', tb); Object.assign(this.devBox.style, { left: '-12px', top: 28 + 2 * 84 + 'px', width: '600px', height: '76px', border: `2px solid ${C.akzent}`, borderRadius: '6px', boxSizing: 'border-box' });

    // stilisierte Abrechnungen (Papier)
    const doc = (x, y, title, sub, items, rot) => {
      const d = el('div', 'abs', h);
      Object.assign(d.style, { left: x + 'px', top: y + 'px', width: '392px', height: '420px', background: '#F4F4F7', borderRadius: '6px', boxShadow: '0 18px 40px rgba(0,0,0,0.35)', transform: `rotate(${rot}deg)`, overflow: 'hidden' });
      const hd = el('div', 'abs', d); Object.assign(hd.style, { left: 0, top: 0, width: '392px', height: '8px', background: C.blau });
      txt(d, title, 26, 26, LF(19, 700, '#1A1A1A'));
      txt(d, sub, 26, 54, SG(13, 500, '#666'));
      const lines = [];
      items.forEach((it, i) => {
        const y2 = 96 + i * 46;
        if (it.bar) { const b = el('div', 'abs', d); Object.assign(b.style, { left: '26px', top: y2 + 8 + 'px', width: it.bar + 'px', height: '9px', background: '#D9D9E2', borderRadius: '3px' }); const b2 = el('div', 'abs', d); Object.assign(b2.style, { left: '300px', top: y2 + 8 + 'px', width: '66px', height: '9px', background: '#D9D9E2', borderRadius: '3px' }); }
        else { txt(d, it.l, 26, y2, LF(15, 600, '#1A1A1A')); txt(d, it.v, 226, y2, SG(15, 700, '#1A1A1A', { width: '140px', textAlign: 'right' })); }
        const line = el('div', 'abs', d); Object.assign(line.style, { left: '26px', top: y2 + 30 + 'px', width: '340px', height: '1px', background: '#E0E0E0' });
        lines.push({ y: y2, it });
      });
      const tag = txt(d, 'Beispieldaten', 26, 386, SG(11, 500, '#8D8AB8', CAPS));
      const scan = el('div', 'abs', d); Object.assign(scan.style, { left: '14px', width: '364px', height: '30px', border: `2px solid ${C.akzent}`, borderRadius: '4px', boxSizing: 'border-box', opacity: 0 });
      return { d, lines, scan };
    };
    this.docDV = doc(664, 96, 'Abrechnung Direktvermarkter', 'Gutschrift · Mai 2026', [
      { bar: 180 }, { l: 'Direktvermarktung', v: MONAT.dv.abgerechnet }, { bar: 210 }, { bar: 150 }, { bar: 196 }, { bar: 120 }], -1.2);
    this.docNB = doc(702, 300, 'Abrechnung Netzbetreiber', 'Mai 2026', [
      { bar: 170 }, { l: 'Marktprämie', v: MONAT.mp.abgerechnet }, { l: 'Ausfallenergie', v: MONAT.ae.abgerechnet }, { bar: 190 }, { bar: 140 }, { bar: 176 }], 1.0);

    // Nachweis-Dokument (eigene Ebene, damit es in die Anlagenakte übergehen kann)
    const n = (this.proof = el('div', 'abs', this.body));
    Object.assign(n.style, { left: '32px', top: '408px', width: '560px', height: '332px', background: '#F4F4F7', borderRadius: '6px', boxShadow: '0 18px 44px rgba(0,0,0,0.4)', overflow: 'hidden' });
    const nh = el('div', 'abs', n); Object.assign(nh.style, { left: 0, top: 0, width: '560px', height: '8px', background: C.akzent });
    txt(n, 'Nachweis Ausfallenergie', 26, 24, LF(21, 700, '#1A1A1A'));
    txt(n, 'Mai 2026 · Abregelungszeiträume und berechnete Mengen', 26, 54, SG(13, 500, '#666'));
    const pdf = txt(n, 'PDF', 488, 26, SG(12, 700, '#fff', { background: C.blau, padding: '4px 8px', borderRadius: '3px', letterSpacing: '0.1em' }));
    const ms = svgEl('svg', { width: 508, height: 132, viewBox: `${PX0} ${PY0 - 6} ${PX1 - PX0} ${PY1 - PY0 + 8}`, preserveAspectRatio: 'none' }, n);
    Object.assign(ms.style, { position: 'absolute', left: '26px', top: '84px' });
    svgEl('path', { d: pathFrom(pIst) + ` L${xh(H1)} ${yP(0)} L${xh(H0)} ${yP(0)} Z`, fill: 'rgba(47,36,130,0.22)' }, ms);
    EVENTS.forEach((e) => {
      const top = pathFrom(pMoeglich, e.von, e.bis, 60); let bot = '';
      for (let i = 60; i >= 0; i--) { const hh = e.von + ((e.bis - e.von) * i) / 60; bot += ` L${xh(hh).toFixed(1)} ${yP(pIst(hh)).toFixed(1)}`; }
      svgEl('path', { d: top + bot + ' Z', fill: 'rgba(200,60,48,0.55)' }, ms);
    });
    svgEl('path', { d: pathFrom(pMoeglich), fill: 'none', stroke: '#2F2482', 'stroke-width': 3, 'stroke-dasharray': '8 7', 'vector-effect': 'non-scaling-stroke' }, ms);
    svgEl('path', { d: pathFrom(pIst), fill: 'none', stroke: '#1A1A1A', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }, ms);
    const kv = [['Abregelungszeiträume', '6'], ['Ausfallenergie berechnet', '35,7&nbsp;MWh'], ['Datenbasis', 'Einstrahlung · Anlagendaten · Vorgaben']];
    kv.forEach(([k, v], i) => { txt(n, k, 26, 232 + i * 28, SG(13, 500, '#666')); txt(n, v, 250, 232 + i * 28, SG(13, 700, '#1A1A1A')); });
    txt(n, 'Beispieldaten', 26, 306, SG(11, 500, '#8D8AB8', CAPS));
  }

  // ---------------- Anlagenakte (Szene 6) ----------------
  buildPlant() {
    const h = (this.plant = el('div', 'abs', this.body)); Object.assign(h.style, { left: 0, top: 0, width: R.w + 'px', height: R.h + 'px' });
    // Lageplan-Streifen
    const pb = (this.planBox = el('div', 'abs', h));
    Object.assign(pb.style, { left: '32px', top: '92px', width: '1056px', height: '176px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px' });
    txt(pb, 'Lageplan · schematisch', 470, 20, SG(13, 500, C.sec, CAPS));
    txt(pb, `Freifläche · ${fmt(PARK.kWp / 1000, 1)}&nbsp;MWp<br><span style="color:${C.sec}">${tables.length} Modultische · ${(tables.length * 28).toLocaleString('de-DE')} Module</span>`, 470, 52, SG(19, 700, '#fff', { lineHeight: 1.5 }));
    txt(pb, `Übergabestation <span style="color:${C.akzent}">●</span> &nbsp; Einstrahlungssensor <span style="color:#fff">●</span>`, 470, 128, SG(13, 500, C.hell));
    // Karten
    const card = (i, title, rows) => {
      const x = 32 + i * 352;
      const c = el('div', 'abs', h);
      Object.assign(c.style, { left: x + 'px', top: '290px', width: '336px', height: '452px', boxSizing: 'border-box', padding: '20px 22px', background: 'rgba(255,255,255,0.04)', borderTop: '3px solid rgba(255,255,255,0.25)', borderRadius: '4px' });
      txt(c, title, 22, 18, SG(13, 500, C.sec, CAPS));
      const items = rows.map((r, j) => {
        const y = 54 + j * 47;
        const it = el('div', 'abs', c); Object.assign(it.style, { left: '22px', top: y + 'px', width: '292px', height: '42px', borderTop: j ? '1px solid rgba(255,255,255,0.08)' : 'none' });
        if (r.doc) {
          const ic = svgEl('svg', { width: 16, height: 20 }, it); Object.assign(ic.style, { position: 'absolute', left: 0, top: '12px' });
          svgEl('path', { d: 'M1 1 H10 L15 6 V19 H1 Z', fill: 'none', stroke: r.hi ? C.akzent : 'rgba(255,255,255,0.7)', 'stroke-width': 1.4 }, ic);
          txt(it, r.doc, 28, 12, LF(16, r.hi ? 700 : 400, '#fff'));
          if (r.hi) txt(it, 'neu', 252, 13, SG(11, 700, '#fff', { background: C.akzent, padding: '2px 6px', borderRadius: '3px', letterSpacing: '0.08em' }));
        } else {
          txt(it, r[0], 0, 12, SG(13, 500, C.sec));
          txt(it, r[1], 130, 10, SG(16, 700, '#fff', { width: '162px', textAlign: 'right' }));
        }
        return it;
      });
      return { c, items };
    };
    this.cards = [
      card(0, 'Stammdaten', [['Anlagentyp', 'Freifläche'], ['Installiert', '9,8&nbsp;MWp'], ['Anschluss', '8,5&nbsp;MW'], ['Inbetriebnahme', PARK.inbetriebnahme], ['Ausrichtung', 'Süd · 20°'], ['Netzbetreiber', 'hinterlegt'], ['Direktvermarkter', 'hinterlegt'], ['MaStR-Nummer', 'hinterlegt']]),
      card(1, 'Unterlagen', [{ doc: 'Anlagenzertifikat' }, { doc: 'Netzanschlussvertrag' }, { doc: 'Direktvermarktungsvertrag' }, { doc: 'Inbetriebnahmeprotokoll' }, { doc: 'Wartungsprotokolle' }, { doc: 'Nachweis Ausfallenergie', hi: true }]),
      card(2, 'Betrieb', [['Datenquellen', '4/4 verbunden'], ['Meldungen', '2 offen'], ['Letzte Wartung', '03/2026'], ['Nächste Prüfung', '09/2026'], ['Betriebsführung', 'ip³'], ['Ansprechpartner', 'persönlich']]),
    ];
    // Lageplan als SVG aus denselben Layoutdaten wie die 3D-Welt
    const ps = (this.planSvg = svgEl('svg', { viewBox: `${FENCE.x0 - 4} ${FENCE.z0 - 4} ${FENCE.x1 - FENCE.x0 + 8} ${FENCE.z1 - FENCE.z0 + 8}`, preserveAspectRatio: 'none' }, null));
    svgEl('rect', { x: FENCE.x0, y: FENCE.z0, width: FENCE.x1 - FENCE.x0, height: FENCE.z1 - FENCE.z0, fill: 'none', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, ps);
    let rowsD = '';
    for (const tb of tables) {
      const x0 = tb.x - TABLE.w / 2, x1 = tb.x + TABLE.w / 2;
      rowsD += `M${x0.toFixed(1)} ${(tb.z - TABLE.depth / 2).toFixed(2)} H${x1.toFixed(1)} V${(tb.z + TABLE.depth / 2).toFixed(2)} H${x0.toFixed(1)} Z `;
    }
    svgEl('path', { d: rowsD, fill: 'rgba(255,255,255,0.22)', stroke: 'rgba(255,255,255,0.6)', 'stroke-width': 0.6, 'vector-effect': 'non-scaling-stroke' }, ps);
    svgEl('rect', { x: STATION.x - STATION.w / 2, y: STATION.z - STATION.d / 2, width: STATION.w, height: STATION.d, fill: C.akzent }, ps);
    svgEl('circle', { cx: STATION.x, cy: STATION.z, r: 5, fill: C.akzent }, ps);
    svgEl('circle', { cx: colX(SENSOR.b, SENSOR.c) + 7.6, cy: SENSOR.z - 2.4, r: 3.5, fill: '#fff' }, ps);
    this.planHolder = el('div', 'abs', root_of(h));
    this.planHolder.appendChild(ps);
    ps.style.position = 'absolute'; ps.style.left = '0'; ps.style.top = '0'; ps.style.width = '100%'; ps.style.height = '100%'; ps.style.overflow = 'visible';
  }

  // planTarget: Zielrechteck (Bildschirm) des Lageplans im 3D-Draufblick
  update(t, planTarget) {
    const on = t > T_ON && t < T_OFF + 0.4;
    this.panel.style.display = on ? 'block' : 'none';
    this.planHolder.style.display = t > 64.9 && t < 72.0 ? 'block' : 'none';
    if (!on && !(t > 64.9 && t < 72.0)) return;

    // Rahmen und Kopf
    const fin = prog(21.15, 21.5, t), fout = ease.inOutCubic(prog(70.5, 71.05, t));
    this.frame.style.opacity = String(fin * (1 - fout));
    this.head.style.opacity = String(ease.outCubic(prog(21.2, 21.7, t)) * (1 - fout));
    // aktiver Reiter
    let act = 0; TAB_T.forEach((tt, i) => { if (t >= tt) act = i; });
    const nxt = Math.min(act + 1, TABS.length - 1);
    const tr = act < TABS.length - 1 ? ease.inOutCubic(prog(TAB_T[nxt] - 0.25, TAB_T[nxt] + 0.15, t)) : 0;
    this.tabs.forEach((tl, i) => { tl.style.color = i === act ? '#fff' : 'rgba(255,255,255,0.45)'; });
    const tabX = (i) => this.tabX[i], tabW = (i) => this.tabW[i];
    this.tabLine.style.left = lerp(tabX(act), tabX(nxt), tr) + 'px';
    this.tabLine.style.width = lerp(tabW(act), tabW(nxt), tr) + 'px';

    // ---- Übersicht ----
    this.ovTiles.forEach((tl, i) => fadeEl(tl, t, 21.35 + i * 0.08, 22.95, 0.45, 0.35, 14));
    this.ovRows.forEach((r, i) => fadeEl(r, t, 21.6 + i * 0.08, 22.95, 0.45, 0.35, 10));
    this.ov.style.display = t < 23.0 ? 'block' : 'none';

    // ---- Diagramm ----
    const chOn = ease.outCubic(prog(22.85, 23.35, t)) * (1 - ease.inOutCubic(prog(52.35, 52.85, t)));
    this.chart.style.opacity = String(chOn);
    this.axisLabels.style.opacity = String(chOn);
    this.chartTitle.style.opacity = String(chOn);
    // Kurve der tatsächlichen Leistung: in Szene 2 bis 11:30, in Szene 3 bis 21:00
    let hIst;
    if (t < 25.3) hIst = lerp(5, 11.5, ease.inOutSine(prog(23.0, 25.0, t)));
    else if (t < 28.4) hIst = lerp(11.5, 15.0, ease.inOutSine(prog(25.35, 27.6, t)));
    else hIst = lerp(15.0, 21.0, ease.inOutSine(prog(28.65, 31.2, t)));
    this.clipIst.setAttribute('width', String(xh(hIst) - PX0 + 4));
    this.headDot.setAttribute('cx', xh(hIst)); this.headDot.setAttribute('cy', yP(pIst(Math.min(hIst, 20.99))));
    this.headDot.style.opacity = String(t < 31.3 ? prog(23.0, 23.2, t) : 1 - prog(31.3, 31.6, t));
    // Vorgabe-Linie (Szene 3)
    const capOn = prog(25.0, 25.4, t) * (1 - prog(37.6, 38.1, t));
    this.capLine.style.opacity = String(capOn);
    this.clipCap.setAttribute('width', String(xh(Math.max(hIst, t > 25.0 ? 14.0 : 5)) - PX0 + 4));
    if (t > 28.4) this.clipCap.setAttribute('width', String(xh(Math.max(hIst, 17.0)) - PX0 + 4));
    const emph = 0.5 + 0.5 * Math.sin(Math.max(0, t - 31.9) * 5.5);
    const em = t > 31.9 && t < 34.4 ? emph : 0;
    this.capLine.setAttribute('stroke-width', String(2 + 1.4 * em));
    this.legCap.style.opacity = String(capOn);
    this.legend.style.opacity = String(chOn);
    this.legIst[0].style.opacity = '1';
    // Ereignispunkte
    this.evDots.forEach((d, i) => {
      const a = i === 0 ? 25.35 : 28.65;
      d.style.opacity = String(ease.outCubic(prog(a, a + 0.25, t)) * (1 - prog(37.6, 38.0, t)));
      d.setAttribute('r', String(6.5 * (1 + 0.6 * Math.exp(-Math.max(0, t - a) * 3) * (t > a ? 1 : 0))));
    });

    // ---- Spuren (Szene 3) ----
    const lanesOn = ease.outCubic(prog(23.0, 23.6, t)) * (1 - ease.inOutCubic(prog(37.5, 38.0, t)));
    this.lanes.style.opacity = String(lanesOn);
    this.lanesH.style.opacity = String(lanesOn);
    for (const [ln, a] of [[this.laneDV, 25.35], [this.laneRD, 28.65]]) {
      const grow = ease.inOutSine(prog(a + 0.05, a + (a < 27 ? 2.2 : 1.6), t));
      ln.bar.setAttribute('width', String((xh(ln.e.bis) - xh(ln.e.von)) * grow));
      draw(ln.conn, ease.inOutCubic(prog(a, a + 0.5, t)));
      ln.val.style.opacity = String(prog(a + 1.2, a + 1.6, t));
      const hl = t > 31.9 && t < 34.6 ? em : 0;
      ln.conn.setAttribute('stroke-width', String(1.4 + 1.2 * hl));
      ln.lab.style.color = t > a ? (ln.e.id === 'dv' ? C.lav : C.lachs) : C.hell;
    }
    this.log.style.opacity = String(lanesOn);
    this.logRows.forEach((r, i) => fadeEl(r, t, i === 0 ? 26.2 : 29.6, 37.4, 0.45, 0.3, 10));

    // ---- Ertrag (Szene 4) ----
    const yOn = 1 - ease.inOutCubic(prog(52.35, 52.85, t));
    this.yieldH.style.opacity = String(yOn);
    this.irrG.style.opacity = String(yOn * prog(40.7, 41.1, t));
    const hIrr = lerp(5, 21, ease.inOutSine(prog(41.0, 43.6, t)));
    this.clipIrr.setAttribute('width', String(xh(hIrr) - PX0 + 4));
    this.irrDot.setAttribute('cx', xh(hIrr)); this.irrDot.setAttribute('cy', this.yI(irr(hIrr)));
    this.irrDot.style.opacity = String(prog(41.0, 41.2, t) * (1 - prog(43.6, 44.0, t)));
    fadeEl(this.irrLab, t, 40.75, 52.4, 0.4, 0.3, 8);
    fadeEl(this.irrVal, t, 41.0, 43.9, 0.4, 0.3, 0);
    this.irrVal.innerHTML = `${fmt(irr(Math.min(hIrr, 20.9)), 0)}&nbsp;W/m²`;
    fadeEl(this.chip, t, 44.35, 49.0, 0.45, 0.35, 10);
    fadeEl(this.calc, t, 44.9, 49.0, 0.45, 0.35, 0);
    // mögliche Leistung (berechnet)
    const hM = lerp(5, 21, ease.inOutSine(prog(45.2, 47.9, t)));
    this.clipMoeg.setAttribute('width', String(xh(hM) - PX0 + 4));
    this.moegLine.style.opacity = String(0.95 * (1 - prog(52.35, 52.85, t)));
    this.legMoeg.style.opacity = String(prog(45.0, 45.5, t) * (1 - prog(52.35, 52.85, t)));
    this.legIst[0].parentElement && (this.legIst[0].style.opacity = '1');
    // Flächen entgangener Energie
    this.gaps.forEach((gp, i) => { gp.style.opacity = String(ease.outCubic(prog(49.1 + i * 0.35, 49.9 + i * 0.35, t)) * (1 - prog(52.35, 52.85, t))); });
    this.gapLabels.forEach((gl, i) => fadeEl(gl, t, 49.7 + i * 0.35, 52.45, 0.4, 0.3, 6));
    // Kennzahlen
    const tilesIn = (i) => 48.2 + i * 0.25;
    this.tiles.forEach((tl, i) => fadeEl(tl.tl, t, tilesIn(i), 52.45, 0.45, 0.3, 12));
    const cnt = ease.outCubic(prog(48.4, 50.6, t));
    this.tiles[0].v.innerHTML = `${fmt(E_MOEGLICH * cnt, 1)}<span style="font-size:20px;font-weight:500;color:${C.sec}">&nbsp;MWh</span>`;
    this.tiles[1].v.innerHTML = `${fmt(E_IST * cnt, 1)}<span style="font-size:20px;font-weight:500;color:${C.sec}">&nbsp;MWh</span>`;
    const cnt2 = ease.outCubic(prog(49.3, 51.2, t));
    this.tiles[2].v.innerHTML = `${fmt(E_ENTGANGEN * cnt2, 1)}<span style="font-size:20px;font-weight:500;color:${C.sec}">&nbsp;MWh</span>`;
    this.split.style.opacity = String(prog(50.6, 51.1, t));
    // Spur-/Ertragsbereich sichtbar nur in Szene 4
    this.yieldH.style.display = t > 40.5 && t < 52.9 ? 'block' : 'none';

    // ---- Abrechnung (Szene 5) ----
    const bOn = ease.outCubic(prog(52.75, 53.3, t)) * (1 - ease.inOutCubic(prog(64.95, 65.35, t)));
    this.bill.style.display = bOn > 0.001 ? 'block' : 'none';
    this.bill.style.opacity = String(bOn);
    const docIn = (d, a) => { const p = ease.edit(prog(a, a + 0.8, t)); d.d.style.opacity = String(prog(a, a + 0.3, t)); d.d.style.marginTop = `${(1 - p) * 40}px`; };
    docIn(this.docDV, 53.0); docIn(this.docNB, 56.25);
    const rowT = [55.45, 56.8, 57.9];
    this.billRows.forEach((r, i) => {
      const a = rowT[i];
      fadeEl(r.row, t, a - 0.15, 65.4, 0.35, 0.1, 10);
      if (r.ok) draw(r.mark, ease.outCubic(prog(a + 0.45, a + 0.85, t)));
      else r.mark.style.opacity = String(prog(a + 0.5, a + 0.7, t));
      r.note.style.opacity = String(prog(a + 0.6, a + 0.95, t));
    });
    // Prüfmarker auf den Dokumenten
    const scanAt = (d, idx, a, b) => { const o = Math.min(prog(a, a + 0.2, t), 1 - prog(b - 0.2, b, t)); d.scan.style.opacity = String(o); d.scan.style.top = d.lines[idx].y - 6 + 'px'; };
    scanAt(this.docDV, 1, 55.4, 56.5);
    if (t < 57.75) scanAt(this.docNB, 1, 56.75, 57.75); else scanAt(this.docNB, 2, 57.85, 65.0);
    this.devBox.style.opacity = String(prog(59.35, 59.6, t));
    // Nachweis: erscheint, wandert dann verkleinert in die Unterlagen der Anlagenakte
    const pIn = ease.edit(prog(61.25, 62.1, t));
    const fly = ease.inOutCubic(prog(64.85, 65.75, t));
    const sx = lerp(1, 292 / 560, fly), sy = lerp(1, 42 / 332, fly);
    const tx = lerp(0, 384 + 22 - 32, fly), ty = lerp((1 - pIn) * 60, 290 + 54 + 5 * 47 - 408, fly);
    this.proof.style.transformOrigin = '0 0';
    this.proof.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy}) rotate(${(1 - pIn) * -2}deg)`;
    this.proof.style.opacity = String(prog(61.25, 61.5, t) * (1 - prog(65.55, 65.85, t)));
    this.proof.style.display = t > 61.2 && t < 65.9 ? 'block' : 'none';

    // ---- Anlagenakte (Szene 6) ----
    const aOn = ease.outCubic(prog(65.3, 65.8, t));
    this.plant.style.display = t > 65.25 ? 'block' : 'none';
    this.plant.style.opacity = String(aOn);
    this.cards.forEach((c, i) => {
      fadeEl(c.c, t, 65.6 + i * 0.12, 70.75, 0.45, 0.35, 14);
      c.items.forEach((it, j) => { it.style.opacity = String(prog(65.9 + i * 0.12 + j * 0.06, 66.3 + i * 0.12 + j * 0.06, t)); });
    });
    this.planBox.style.opacity = String(prog(65.4, 65.8, t) * (1 - prog(70.4, 70.7, t)));

    // Lageplan: aus der Karte auf Vollbild, deckungsgleich mit dem 3D-Draufblick
    const box0 = { x: R.x + 32 + 12, y: R.y + 92 + 12, w: 434, h: 152 };
    const g = ease.inOutQuart(prog(70.35, 71.25, t));
    const tgt = planTarget || { x: 160, y: 340, w: 1600, h: 400 };
    const B = { x: lerp(box0.x, tgt.x, g), y: lerp(box0.y, tgt.y, g), w: lerp(box0.w, tgt.w, g), h: lerp(box0.h, tgt.h, g) };
    Object.assign(this.planHolder.style, { left: B.x + 'px', top: B.y + 'px', width: B.w + 'px', height: B.h + 'px' });
    this.planHolder.style.opacity = String(prog(65.5, 65.9, t) * (1 - prog(71.35, 71.85, t)));
  }
}

function root_of(e) { let r = e; while (r.parentElement && r.parentElement.id !== 'ov') r = r.parentElement; return r.parentElement || r; }
