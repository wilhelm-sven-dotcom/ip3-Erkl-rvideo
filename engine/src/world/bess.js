import * as THREE from 'three';
import { BESS } from './layout.js';

// Batteriespeicher als transparentes Planungsszenario: Kanten in Weiß, Flächen kaum sichtbar.

export function buildBess() {
  const group = new THREE.Group();
  const cx = (BESS.x0 + BESS.x1) / 2, cz = (BESS.z0 + BESS.z1) / 2;
  const items = [];
  const fillMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false });
  const edgeMat = (c = 0xffffff) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.0 });
  const box = (x, z, w, h, d, kind) => {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, fillMat());
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat(kind === 'mv' ? 0xffffff : 0xffffff));
    const o = new THREE.Group(); o.add(m, e); o.position.set(x, 0, z);
    group.add(o); items.push({ o, m, e, kind });
  };
  // 6 Container (40 Fuß) in zwei Reihen, 3 Mittelspannungsstationen dazwischen
  for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) box(cx - 14 + i * 14, cz - 9 + r * 18, 12.2, 2.9, 2.45, 'c');
  for (let i = 0; i < 3; i++) box(cx - 14 + i * 14, cz, 6.0, 2.6, 2.5, 'mv');
  // Fläche (Schotter) als Umriss
  const pad = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(BESS.x0, 0.05, BESS.z0), new THREE.Vector3(BESS.x1, 0.05, BESS.z0), new THREE.Vector3(BESS.x1, 0.05, BESS.z1),
    new THREE.Vector3(BESS.x0, 0.05, BESS.z1), new THREE.Vector3(BESS.x0, 0.05, BESS.z0)]);
  const padLine = new THREE.Line(pad, new THREE.LineDashedMaterial({ color: 0xc83c30, dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0 }));
  padLine.computeLineDistances();
  group.add(padLine);
  const padFill = new THREE.Mesh(new THREE.PlaneGeometry(BESS.x1 - BESS.x0, BESS.z1 - BESS.z0), new THREE.MeshBasicMaterial({ color: 0xc83c30, transparent: true, opacity: 0, depthWrite: false }));
  padFill.rotation.x = -Math.PI / 2; padFill.position.set(cx, 0.04, cz);
  group.add(padFill);
  group.traverse((o) => { o.renderOrder = 8; if (o.material) o.material.toneMapped = false; });
  return {
    group, center: new THREE.Vector3(cx, 3.2, cz),
    set(t0, t) {
      const k = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
      const sm = (x) => x * x * (3 - 2 * x);
      const pk = sm(k(t0, t0 + 0.8));
      padLine.material.opacity = 0.95 * pk; padFill.material.opacity = 0.10 * pk;
      items.forEach((it, i) => {
        const a = t0 + 0.4 + i * 0.12, p = sm(k(a, a + 0.9));
        it.o.scale.set(1, Math.max(0.001, p), 1);
        it.e.material.opacity = 0.95 * p; it.m.material.opacity = 0.14 * p;
        it.o.visible = p > 0.001;
      });
      group.visible = t > t0;
    },
  };
}
