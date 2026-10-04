import * as THREE from 'three';
import { rng } from '../util.js';
import { FIELD, FENCE, ROADS, STATION, BESS, GATE } from './layout.js';

// Gelände: flach im Park, sanfte Oberpfälzer Hügel nach außen. Bodenfarbe aus zwei
// gemalten Übersichtstexturen (nah: Park und Umgebung, fern: Flur und Wald) plus
// prozeduralem Detailrauschen im Shader.

function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, z, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vn2(x * f, z * f); a *= 0.5; f *= 2.03; } return s; }

const PX = (FIELD.x0 + FIELD.x1) / 2, PZ = (FIELD.z0 + FIELD.z1) / 2;
function distOutside(x, z) {
  const dx = Math.max(FENCE.x0 - x, 0, x - FENCE.x1);
  const dz = Math.max(FENCE.z0 - z, 0, z - (ROADS.county.z + 20));
  return Math.hypot(dx, dz);
}
export function heightAt(x, z) {
  const d = distOutside(x, z);
  const k = THREE.MathUtils.smoothstep(d, 60, 520);
  const hills = fbm(x / 1400 + 3.1, z / 1400 - 1.7, 4) * 70 + fbm(x / 420, z / 420, 3) * 9;
  // leicht ansteigender Hang Richtung Norden für eine ruhige Horizontlinie
  const north = THREE.MathUtils.smoothstep(-z, 400, 2600) * 55;
  return k * (hills + north + 6);
}

// ---------- Flurstücke (Felder, Wiesen, Wald) ----------
export const PARCELS = [];
(function buildParcels() {
  const R = rng(20260504);
  const ang = (11 * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
  const cell = 210;
  for (let i = -22; i <= 22; i++) for (let j = -22; j <= 22; j++) {
    const jit = () => (R() - 0.5) * 50;
    const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => {
      const u = a * cell + jit(), v = b * cell * 1.35 + jit();
      return [u * ca - v * sa + PX, u * sa + v * ca + PZ];
    });
    const cx = corners.reduce((s, c) => s + c[0], 0) / 4, cz = corners.reduce((s, c) => s + c[1], 0) / 4;
    const nearPark = cx > FENCE.x0 - 160 && cx < FENCE.x1 + 160 && cz > FENCE.z0 - 160 && cz < ROADS.county.z + 120;
    const forestN = fbm(cx / 1100 + 7.3, cz / 1100 + 2.2, 3) + (R() - 0.5) * 0.25;
    let type;
    if (!nearPark && forestN > 0.12) type = 'forest';
    else {
      const r = R();
      type = r < 0.38 ? 'meadow' : r < 0.70 ? 'crop' : r < 0.82 ? 'cropLight' : 'soil';
    }
    PARCELS.push({ corners, type, cx, cz, seed: R(), stripeAng: ang + (R() < 0.5 ? 0 : Math.PI / 2) });
  }
})();

const COLORS = {
  meadow: ['#5d7341', '#647a45', '#586d3c'],
  crop: ['#526d34', '#5a7537', '#4c6630'],
  cropLight: ['#7c8650', '#858f57', '#76804b'],
  soil: ['#6e6252', '#776a59', '#66594a'],
  forest: ['#223019', '#27351d', '#1f2c17'],
};

function drawWorld(ctx, size, x0, z0, span, near) {
  const s = size / span;
  const T = (x, z) => [(x - x0) * s, (z - z0) * s];
  ctx.fillStyle = '#5b7140'; ctx.fillRect(0, 0, size, size);
  for (const p of PARCELS) {
    const pal = COLORS[p.type];
    ctx.fillStyle = pal[Math.floor(p.seed * pal.length) % pal.length];
    ctx.beginPath();
    p.corners.forEach(([x, z], k) => { const [u, v] = T(x, z); k ? ctx.lineTo(u, v) : ctx.moveTo(u, v); });
    ctx.closePath(); ctx.fill();
    if (near && (p.type === 'crop' || p.type === 'cropLight' || p.type === 'soil')) {
      // Fahrspuren / Saatreihen
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = Math.max(1, 0.9 * s);
      const [u0, v0] = T(p.cx, p.cz); const dir = p.stripeAng;
      for (let k = -60; k <= 60; k++) {
        const off = k * 3.2 * s;
        const ox = -Math.sin(dir) * off, oy = Math.cos(dir) * off;
        ctx.beginPath(); ctx.moveTo(u0 + ox - Math.cos(dir) * 400 * s, v0 + oy - Math.sin(dir) * 400 * s);
        ctx.lineTo(u0 + ox + Math.cos(dir) * 400 * s, v0 + oy + Math.sin(dir) * 400 * s); ctx.stroke();
      }
      ctx.restore();
    }
  }
  // Feldwege an den Parzellengrenzen
  ctx.strokeStyle = 'rgba(160,150,125,0.55)'; ctx.lineWidth = Math.max(1, 2.5 * s);
  for (const p of PARCELS) if (p.seed > 0.72) {
    ctx.beginPath(); const [a, b] = [p.corners[0], p.corners[1]];
    const [u1, v1] = T(a[0], a[1]); const [u2, v2] = T(b[0], b[1]); ctx.moveTo(u1, v1); ctx.lineTo(u2, v2); ctx.stroke();
  }
  // Park: gemähte Wiese innerhalb des Zauns
  const [fx0, fz0] = T(FENCE.x0, FENCE.z0), [fx1, fz1] = T(FENCE.x1, FENCE.z1);
  ctx.fillStyle = '#617a43'; ctx.fillRect(fx0, fz0, fx1 - fx0, fz1 - fz0);
  if (near) {
    // leichte Mähstreifen zwischen den Reihen
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let z = FIELD.z0; z < FIELD.z1; z += 9.2) { const [, a] = T(0, z); ctx.fillRect(fx0, a, fx1 - fx0, 4.6 * s); }
  }
  // Schotterwege im Park
  ctx.fillStyle = '#aaa393';
  const rect = (xa, za, xb, zb) => { const [u1, v1] = T(xa, za), [u2, v2] = T(xb, zb); ctx.fillRect(u1, v1, u2 - u1, v2 - v1); };
  rect(-3.2, FIELD.z0 - 4, 3.2, FIELD.z1 + 4);                         // Mittelweg N-S
  rect(FIELD.x0 - 6, -2.6, FIELD.x1 + 6, 2.6);                          // Querweg O-W (Lücke Reihe 9/10)
  rect(FIELD.x0 - 8, FIELD.z1 + 3.0, FIELD.x1 + 8, FIELD.z1 + 7.0);     // Ringweg Süd
  rect(STATION.x - 12, STATION.z - 4, STATION.x + 10, STATION.z + 6);    // Stationsfläche
  rect(ROADS.access.x - ROADS.access.w / 2, FENCE.z1 - 6, ROADS.access.x + ROADS.access.w / 2, ROADS.access.z1);
  // Gemeindestraße (Asphalt)
  ctx.fillStyle = '#5b5e63';
  rect(PX - 4000, ROADS.county.z - ROADS.county.w / 2, PX + 4000, ROADS.county.z + ROADS.county.w / 2);
  ctx.fillStyle = 'rgba(235,235,230,0.55)';
  for (let x = PX - 4000; x < PX + 4000; x += 12) rect(x, ROADS.county.z - 0.08, x + 6, ROADS.county.z + 0.08);
  // Zaunstreifen
  ctx.strokeStyle = 'rgba(40,55,30,0.35)'; ctx.lineWidth = Math.max(1, 1.2 * s);
  ctx.strokeRect(fx0, fz0, fx1 - fx0, fz1 - fz0);
}

export function buildTerrain() {
  const NEAR = { x0: PX - 700, z0: PZ - 700, span: 1400, size: 4096 };
  const FAR = { x0: PX - 5000, z0: PZ - 5000, span: 10000, size: 2048 };
  const mk = (cfg, near) => {
    const c = document.createElement('canvas'); c.width = c.height = cfg.size;
    drawWorld(c.getContext('2d'), cfg.size, cfg.x0, cfg.z0, cfg.span, near);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  const nearTex = mk(NEAR, true), farTex = mk(FAR, false);

  const seg = 240, size = 10000;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(PX, 0, PZ);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0, dithering: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNear = { value: nearTex }; sh.uniforms.uFar = { value: farTex };
    sh.uniforms.uNearB = { value: new THREE.Vector3(NEAR.x0, NEAR.z0, NEAR.span) };
    sh.uniforms.uFarB = { value: new THREE.Vector3(FAR.x0, FAR.z0, FAR.span) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP; uniform sampler2D uNear; uniform sampler2D uFar; uniform vec3 uNearB; uniform vec3 uFarB;
float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float gn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(gh(i),gh(i+vec2(1,0)),u.x), mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),u.x), u.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 uvN = (vWP.xz - uNearB.xy) / uNearB.z;
  vec2 uvF = (vWP.xz - uFarB.xy) / uFarB.z;
  vec3 cF = texture2D(uFar, uvF).rgb;
  vec3 cN = texture2D(uNear, uvN).rgb;
  vec2 e = min(uvN, 1.0 - uvN);
  float wN = smoothstep(0.0, 0.06, min(e.x, e.y));
  vec3 base = mix(cF, cN, wN);
  float fwp = length(fwidth(vWP.xz));
  float d1 = gn(vWP.xz * 0.9) - 0.5, d2 = gn(vWP.xz * 0.21 + 3.7) - 0.5, d3 = gn(vWP.xz * 0.035 - 1.3) - 0.5;
  float k1 = 1.0 - smoothstep(0.25, 1.2, fwp);
  float k2 = 1.0 - smoothstep(1.5, 8.0, fwp);
  float detail = d1 * 0.16 * k1 + d2 * 0.14 * k2 + d3 * 0.12;
  vec3 tint = mix(vec3(1.0), vec3(1.05, 1.02, 0.86), clamp(d3 * 1.6 + 0.3, 0.0, 1.0));
  diffuseColor.rgb = base * tint * (1.0 + detail);`);
  };
  mat.customProgramCacheKey = () => 'terrain-v1';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- Bäume ----------
export function buildTrees() {
  const R = rng(4711);
  const R2 = rng(99);
  const jitter = (g, amt) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) {
    const k = 1 + (R2() - 0.5) * amt; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (1 + (R2() - 0.5) * amt * 0.6), p.getZ(i) * k); } return g; };
  const blobs = [[0, 1.8, 0, 1.0], [0.45, 1.45, 0.2, 0.74], [-0.35, 2.15, -0.2, 0.7]].map(([x, y, z, r]) => {
    const g = jitter(new THREE.IcosahedronGeometry(r, 1), 0.16); g.translate(x, y, z); return g; });
  const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.2, 5, 1, true); trunk.translate(0, 0.6, 0);
  const cones = [[1.0, 1.7, 1.15], [0.78, 1.5, 2.0], [0.5, 1.2, 2.8]].map(([r, h, y]) => {
    const g = jitter(new THREE.ConeGeometry(r, h, 7, 1, true), 0.12); g.translate(0, y, 0); return g; });
  const merge = (gs) => {
    const geos = gs.map((g) => (g.index ? g.toNonIndexed() : g));
    const total = geos.reduce((s, g) => s + g.attributes.position.count, 0);
    const p = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
    geos.forEach((g) => { p.set(g.attributes.position.array, o); o += g.attributes.position.array.length; });
    for (let i = 0; i < total; i++) { const y = p[i * 3 + 1]; const k = 0.55 + 0.45 * Math.min(1, Math.max(0, (y - 0.6) / 2.4)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(p, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeVertexNormals();
    return out;
  };
  const gDec = merge([...blobs, trunk]), gCon = merge([...cones, trunk]);
  const inPoly = (x, z, c) => { let ins = false; for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, zi] = c[i], [xj, zj] = c[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
  const pts = { dec: [], con: [] };
  const sorted = PARCELS.filter((p) => p.type === 'forest').map((p) => ({ p, d: Math.hypot(p.cx - PX, p.cz - PZ) })).sort((a, b) => a.d - b.d);
  let budget = 5200;
  for (const { p, d } of sorted) {
    if (d > 2600 || budget <= 0) break;
    const n = Math.min(budget, Math.round(d < 1000 ? 300 : d < 1800 ? 150 : 80));
    const xs = p.corners.map((c) => c[0]), zs = p.corners.map((c) => c[1]);
    const [xa, xb, za, zb] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    let k = 0, tries = 0;
    while (k < n && tries < n * 4) {
      tries++;
      const x = xa + R() * (xb - xa), z = za + R() * (zb - za);
      if (!inPoly(x, z, p.corners)) continue;
      const s = (d < 1500 ? 4.2 : 6.0) * (0.75 + R() * 0.6);
      (R() < 0.62 ? pts.con : pts.dec).push([x, heightAt(x, z), z, s, R()]);
      k++; budget--;
    }
  }
  // Heckenstreifen außen am Zaun (West, Nord, Ost) und entlang der Gemeindestraße
  const hedge = (xa, za, xb, zb, step) => {
    const L = Math.hypot(xb - xa, zb - za), n = Math.floor(L / step);
    for (let i = 0; i <= n; i++) { const t = i / n; const x = xa + (xb - xa) * t + (R() - 0.5) * 2.5, z = za + (zb - za) * t + (R() - 0.5) * 2.5;
      pts.dec.push([x, heightAt(x, z), z, 2.6 + R() * 1.6, R()]); }
  };
  hedge(FENCE.x0 - 9, FENCE.z0 - 9, FENCE.x1 + 9, FENCE.z0 - 9, 4.5);
  hedge(FENCE.x0 - 9, FENCE.z0 - 9, FENCE.x0 - 9, FENCE.z1 + 2, 4.5);
  hedge(FENCE.x1 + 9, FENCE.z0 - 9, FENCE.x1 + 9, BESS.z0 - 12, 4.5);
  const group = new THREE.Group();
  const near = (a) => Math.hypot(a[0] - PX, a[2] - PZ) < 520;
  const mk = (geo, arr, colA, colB, shadows) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true, flatShading: false });
    const im = new THREE.InstancedMesh(geo, mat, arr.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    arr.forEach(([x, y, z, s, r], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * 6.28);
      m.compose(new THREE.Vector3(x, y - 0.2, z), q, new THREE.Vector3(s, s * (0.9 + r * 0.35), s));
      im.setMatrixAt(i, m);
      c.set(colA).lerp(new THREE.Color(colB), r); im.setColorAt(i, c);
    });
    im.castShadow = shadows; im.receiveShadow = false;
    group.add(im);
  };
  mk(gCon, pts.con.filter(near), '#1b2b1a', '#283a23', true);
  mk(gCon, pts.con.filter((a) => !near(a)), '#1b2b1a', '#283a23', false);
  mk(gDec, pts.dec.filter(near), '#2c4425', '#3f5a2e', true);
  mk(gDec, pts.dec.filter((a) => !near(a)), '#2c4425', '#3f5a2e', false);
  return group;
}
