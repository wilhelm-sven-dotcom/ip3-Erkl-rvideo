import * as THREE from 'three';
import { createModuleMaterial } from './moduleMaterial.js';
import { TABLE, tables, FENCE, STATION, SENSOR, GATE, COLS, ROWS, rowZ, colX, tablePoint } from './layout.js';

// Modultische, Unterkonstruktion, Wechselrichter, Zaun, Übergabestation und Einstrahlungssensor.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function instanced(geo, mat, list, { cast = true, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4();
  list.forEach((tr, i) => { m.compose(tr.p, tr.q || new THREE.Quaternion(), tr.s || V(1, 1, 1)); im.setMatrixAt(i, m); });
  im.castShadow = cast; im.receiveShadow = receive;
  return im;
}

export function buildPark() {
  const group = new THREE.Group();
  const tiltQ = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), TABLE.tilt);

  // --- Modultische ---
  const moduleMat = createModuleMaterial();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.38 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.0, roughness: 0.75 });
  const slab = new THREE.BoxGeometry(TABLE.w, 0.04, TABLE.d);
  const tableList = tables.map((t) => ({ p: V(t.x, TABLE.cy, t.z), q: tiltQ }));
  const tablesMesh = instanced(slab, [frameMat, frameMat, moduleMat, backMat, frameMat, frameMat], tableList);
  group.add(tablesMesh);

  // --- Unterkonstruktion (verzinkter Stahl) ---
  const steel = new THREE.MeshStandardMaterial({ color: 0x9da3aa, metalness: 0.75, roughness: 0.5 });
  const ct = Math.cos(TABLE.tilt), st = Math.sin(TABLE.tilt);
  const zFront = TABLE.depth / 2 - 0.55, zBack = -TABLE.depth / 2 + 0.55;
  const yAt = (dz) => TABLE.cy - dz * Math.tan(TABLE.tilt) - 0.12; // Höhe unter der Modulebene
  const posts = [], rafters = [], purlins = [];
  const postXs = [-6.0, -2.0, 2.0, 6.0];
  for (const t of tables) {
    for (const px of postXs) {
      const hf = yAt(zFront), hb = yAt(zBack);
      posts.push({ p: V(t.x + px, hf / 2, t.z + zFront), s: V(0.11, hf, 0.07) });
      posts.push({ p: V(t.x + px, hb / 2, t.z + zBack), s: V(0.11, hb, 0.07) });
      rafters.push({ p: V(t.x + px, TABLE.cy - 0.13 * ct, t.z - 0.13 * st), q: tiltQ, s: V(0.07, 0.09, TABLE.d - 0.3) });
    }
    for (const f of [-0.27, 0.27]) {
      const s = f * TABLE.d;
      purlins.push({ p: V(t.x, TABLE.cy + s * st - 0.055 * ct, t.z - s * ct - 0.055 * st), q: tiltQ, s: V(TABLE.w - 0.2, 0.06, 0.05) });
    }
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  group.add(instanced(unit, steel, posts));
  group.add(instanced(unit, steel, rafters));
  group.add(instanced(unit, steel, purlins));

  // --- String-Wechselrichter am Ostende jeder Reihe und jedes Blocks ---
  const invMat = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 0.15, roughness: 0.55 });
  const inverters = [];
  for (let r = 0; r < ROWS; r++) for (let b = 0; b < 2; b++) {
    const x = colX(b, COLS - 1) + 6.0, z = rowZ(r) + zBack - 0.22;
    inverters.push({ p: V(x, 1.15, z), s: V(0.74, 0.62, 0.27), r, b });
  }
  group.add(instanced(unit, invMat, inverters));

  // --- Zaun ---
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x55605a, metalness: 0.4, roughness: 0.6 });
  const fposts = [];
  const meshMat = new THREE.MeshStandardMaterial({ color: 0x6a736e, transparent: true, opacity: 0.22, roughness: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const fenceSide = (xa, za, xb, zb) => {
    const L = Math.hypot(xb - xa, zb - za), n = Math.round(L / 3);
    for (let i = 0; i <= n; i++) { const k = i / n; fposts.push({ p: V(xa + (xb - xa) * k, 1.0, za + (zb - za) * k), s: V(0.07, 2.0, 0.07) }); }
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.9), meshMat);
    pl.position.set((xa + xb) / 2, 1.0, (za + zb) / 2); pl.rotation.y = -Math.atan2(zb - za, xb - xa);
    group.add(pl);
  };
  fenceSide(FENCE.x0, FENCE.z0, FENCE.x1, FENCE.z0);
  fenceSide(FENCE.x1, FENCE.z0, FENCE.x1, FENCE.z1);
  fenceSide(FENCE.x0, FENCE.z1, GATE.x - 3, FENCE.z1);
  fenceSide(GATE.x + 3, FENCE.z1, FENCE.x1, FENCE.z1);
  fenceSide(FENCE.x0, FENCE.z0, FENCE.x0, FENCE.z1);
  group.add(instanced(unit, fenceMat, fposts));

  // --- Übergabestation (Betonfertigteil) ---
  const station = buildStation();
  group.add(station.group);

  // --- Einstrahlungssensor (Pyranometer in Modulebene) ---
  const sensor = buildSensor();
  group.add(sensor);

  return { group, moduleMat, tablesMesh, station, sensor, inverters };
}

function facadeTexture() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 520;
  const g = c.getContext('2d');
  g.fillStyle = '#c7c6c0'; g.fillRect(0, 0, 1200, 520);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.025)`; g.fillRect(Math.random() * 1200, Math.random() * 520, 3, 3); }
  // Sockelstreifen
  g.fillStyle = '#b3b2ac'; g.fillRect(0, 470, 1200, 50);
  // drei Türen mit Lüftungsgittern
  const door = (x, w) => {
    g.fillStyle = '#59606a'; g.fillRect(x, 70, w, 400);
    g.fillStyle = '#4b525b'; for (let y = 90; y < 200; y += 12) g.fillRect(x + 18, y, w - 36, 6);
    for (let y = 340; y < 450; y += 12) g.fillRect(x + 18, y, w - 36, 6);
    g.fillStyle = '#9aa1aa'; g.fillRect(x + w - 34, 260, 10, 34);
    // Warnschild
    g.fillStyle = '#e8c21e'; g.beginPath(); g.moveTo(x + w / 2, 222); g.lineTo(x + w / 2 + 22, 258); g.lineTo(x + w / 2 - 22, 258); g.closePath(); g.fill();
  };
  door(120, 230); door(485, 230); door(850, 230);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function buildStation() {
  const group = new THREE.Group();
  const S = STATION;
  const concrete = new THREE.MeshStandardMaterial({ color: 0xc8c7c1, roughness: 0.9 });
  const front = new THREE.MeshStandardMaterial({ map: facadeTexture(), roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(S.w, S.h, S.d), [concrete, concrete, concrete, concrete, front, concrete]);
  body.position.set(S.x, S.h / 2, S.z); body.castShadow = true; body.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(S.w + 0.3, 0.16, S.d + 0.3), new THREE.MeshStandardMaterial({ color: 0xbebdb7, roughness: 0.9 }));
  roof.position.set(S.x, S.h + 0.08, S.z); roof.castShadow = true; roof.receiveShadow = true;
  group.add(body, roof);
  // Kantenlinien für den Übergang in die schematische Darstellung
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S.w + 0.02, S.h + 0.02, S.d + 0.02)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false }));
  edges.position.copy(body.position); edges.renderOrder = 10;
  group.add(edges);
  return { group, body, roof, edges, materials: [concrete, front] };
}

function buildSensor() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.35, metalness: 0.05 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.5 });
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.42), new THREE.MeshStandardMaterial({ color: 0x9da3aa, metalness: 0.7, roughness: 0.45 }));
  arm.position.set(0, 0.0, 0.14);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.008, 32), white); shade.position.y = 0.035;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 32), white); body.position.y = 0.06;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 32), dark); ring.position.y = 0.093;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.026, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass); dome.position.y = 0.097;
  const head = new THREE.Group(); head.add(shade, body, ring, dome); head.position.set(0, 0.03, 0.0);
  g.add(arm, head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // an der Oberkante des Tisches, Kopf parallel zur Modulebene
  const p = tablePoint(colX(SENSOR.b, SENSOR.c), SENSOR.z, 0.975, 0.995, 0.0);
  g.position.set(p[0], p[1] + 0.01, p[2]);
  g.quaternion.setFromAxisAngle(V(1, 0, 0), TABLE.tilt);
  g.scale.setScalar(1.6);
  return g;
}
