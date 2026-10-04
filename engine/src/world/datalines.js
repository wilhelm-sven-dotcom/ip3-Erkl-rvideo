import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { HERO, SENSOR, STATION, TABLE, ROWS, COLS, rowZ, colX, tablePoint, FIELD } from './layout.js';

// Abstrahierter Datenstrom: Linien wachsen vom Modul, vom Sensor und von den Wechselrichtern
// zur Übergabestation. Der rote Kopfpunkt ist das Leitmotiv des Films.

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

class PathLine {
  constructor(points, { color, width, opacity = 1, W, H }) {
    this.pts = points.map((p) => new THREE.Vector3(...p));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.len = this.cum[this.cum.length - 1];
    this.geo = new LineGeometry();
    this.mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthTest: true, worldUnits: false });
    this.mat.resolution.set(W, H);
    this.mat.toneMapped = false;
    this.line = new Line2(this.geo, this.mat);
    this.line.frustumCulled = false;
    this.line.renderOrder = 5;
    this.baseOpacity = opacity;
    this.setDraw(0);
  }
  pointAt(L) {
    L = Math.max(0, Math.min(this.len, L));
    let i = 1; while (i < this.cum.length - 1 && this.cum[i] < L) i++;
    const a = this.pts[i - 1], b = this.pts[i], seg = this.cum[i] - this.cum[i - 1];
    return a.clone().lerp(b, seg > 0 ? (L - this.cum[i - 1]) / seg : 0);
  }
  setDraw(frac) {
    const L = Math.max(0.0001, Math.min(1, frac)) * this.len;
    const arr = [];
    for (let i = 0; i < this.pts.length && this.cum[i] < L; i++) arr.push(this.pts[i].x, this.pts[i].y, this.pts[i].z);
    const e = this.pointAt(L); arr.push(e.x, e.y, e.z);
    if (arr.length < 6) arr.push(e.x, e.y, e.z + 0.0001);
    this.geo.dispose(); this.geo = new LineGeometry(); this.geo.setPositions(arr); this.line.geometry = this.geo;
    this.line.visible = frac > 0.0005;
    this.head = e;
  }
}

export function buildDataLines(W, H) {
  const group = new THREE.Group();
  const RED = new THREE.Color('#e0473a'), WHITE = new THREE.Color('#ffffff');
  const ct = Math.cos(TABLE.tilt), st = Math.sin(TABLE.tilt);
  const gapZ = (r) => rowZ(r) + TABLE.depth / 2 + 2.3; // Bodenlinie südlich der Reihe r
  const eastX = FIELD.x1 + 3.2;
  const stIn = [STATION.x + STATION.w / 2 - 0.1, 1.3, STATION.z];

  // Hero: von der Zelle über die Modulfläche nach unten, am Boden zur Station
  const HU = 0.47031; // exakt auf einem Busbar des 7. Moduls
  const hx = HERO.x + (HU - 0.5) * TABLE.w;
  const heroPts = [];
  for (let k = 0; k <= 12; k++) { const v = 0.74 - (0.74 * k) / 12; heroPts.push(tablePoint(HERO.x, HERO.z, HU, v, 0.004)); }
  const lowEdge = heroPts[heroPts.length - 1];
  heroPts.push([hx, 0.06, lowEdge[2] + 0.15], [hx, 0.06, gapZ(HERO.r)], [eastX, 0.06, gapZ(HERO.r)], [eastX, 0.06, STATION.z], stIn);
  const hero = new PathLine(heroPts, { color: RED, width: 3.2, W, H });
  group.add(hero.line);

  // Sensor
  const sp = tablePoint(colX(SENSOR.b, SENSOR.c), SENSOR.z, 0.975, 1.0, 0.1);
  const sensor = new PathLine([sp, [sp[0], 0.06, sp[2]], [sp[0], 0.06, gapZ(0) - 4.6], [eastX, 0.06, gapZ(0) - 4.6], [eastX, 0.06, STATION.z], stIn],
    { color: WHITE, width: 2.0, opacity: 0.9, W, H });
  group.add(sensor.line);

  // Wechselrichter-Stränge (Datenlogger) entlang des Ostwegs
  const invLines = [];
  for (let r = 2; r < ROWS; r += 2) {
    const ix = colX(1, COLS - 1) + 6.0, iz = rowZ(r) - TABLE.depth / 2 + 0.33;
    const pl = new PathLine([[ix, 1.15, iz], [ix, 0.06, iz], [ix, 0.06, iz - 0.0 + 1.2], [eastX + 0.6 + r * 0.08, 0.06, iz + 1.2], [eastX + 0.6 + r * 0.08, 0.06, STATION.z - 0.4], stIn],
      { color: WHITE, width: 1.6, opacity: 0.75, W, H });
    invLines.push(pl); group.add(pl.line);
  }

  // Leuchtkopf (Leitmotiv-Punkt)
  const glowTex = glowTexture();
  const mkSprite = (color, size) => {
    const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
    m.toneMapped = false;
    const s = new THREE.Sprite(m); s.scale.setScalar(size); s.renderOrder = 20; group.add(s); return s;
  };
  const heroDot = mkSprite(new THREE.Color('#ff5a48'), 0.05);
  const heroCore = mkSprite(new THREE.Color('#ffffff'), 0.012);
  const stationGlow = mkSprite(new THREE.Color('#ff5a48'), 0.0);

  return { group, hero, sensor, invLines, heroDot, heroCore, stationGlow, all: [hero, sensor, ...invLines] };
}
