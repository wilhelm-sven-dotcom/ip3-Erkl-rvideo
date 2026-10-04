import * as THREE from 'three';
import { shotA, shotB, macro, shotC, shotD } from './shots.js';
import { buildBess } from './bess.js';
import { FENCE } from './layout.js';
import { mono } from './rig.js';
import { buildDataLines } from './datalines.js';
import { prog, ease, smooth, clamp, lerp } from '../util.js';

// Regie der 3D-Passagen: wählt pro Zeitpunkt Einstellung, Sonnenstand und Effekte.

export class Director {
  constructor(world) {
    this.w = world;
    this.data = buildDataLines(world.W, world.H);
    world.scene.add(this.data.group);
    this.bess = buildBess();
    world.scene.add(this.bess.group);
    this.info = {};
    const H = this.data.hero;
    this.onModule = H.cum[12];
    this.shotB = shotB(H.pointAt(this.onModule).toArray());
    this.mAz = mono(macro.az); this.mEl = mono(macro.el);
    const ld = mono(macro.dist.map(([t, d]) => [t, Math.log(d)])); this.mDist = (t) => Math.exp(ld(t));
  }

  heroLen(t) {
    const H = this.data.hero, om = this.onModule;
    if (t < 11.0) return 0;
    if (t < 12.35) return om * ease.inOutSine(prog(11.0, 12.35, t));
    return om + (H.len - om) * ease.inOutCubic(prog(12.35, 13.95, t));
  }

  // Liefert true, wenn zu diesem Zeitpunkt 3D gerendert werden muss
  active(t) {
    return (t >= 0 && t < 15.05) || (t >= 70.55 && t < 85.2);
  }

  // Kamera für Zeitpunkt t setzen (ohne Rendern)
  pose(t) {
    const w = this.w, cam = w.camera;
    let s;
    if (t < 10.75) s = shotA(t);
    else if (t < 12.35) {
      // Ziel folgt dem Datenpunkt mit leichtem Nachlauf
      const H = this.data.hero;
      const tg = H.pointAt(this.heroLen(Math.max(10.75, t - 0.05))).toArray();
      const a = (this.mAz(t) * Math.PI) / 180, e = (this.mEl(t) * Math.PI) / 180, dd = this.mDist(t);
      s = { target: tg, pos: [tg[0] + Math.sin(a) * Math.cos(e) * dd, tg[1] + Math.sin(e) * dd, tg[2] + Math.cos(a) * Math.cos(e) * dd], fov: macro.fov, dist: dd };
    } else if (t < 50) {
      s = this.shotB(t);
      // Aufzug: Ziel bleibt zunächst auf dem Datenpunkt, dann Übergang in den Überblick
      if (t < 13.6) {
        const head = this.data.hero.pointAt(this.heroLen(t)).toArray();
        const k = smooth(12.95, 13.6, t);
        const tg = head.map((v, i) => lerp(v, s.target[i], k));
        const off = s.pos.map((v, i) => v - s.target[i]);
        s = { ...s, target: tg, pos: tg.map((v, i) => v + off[i]) };
      }
    }
    else if (t < 80.0) s = shotC(t);
    else s = shotD(t);
    if (t < 50) w.setSun(54, 145); else w.setSun(31, 222);
    w.renderer.toneMappingExposure = t < 50 ? 0.6 : 0.72;
    cam.position.set(...s.pos); cam.fov = s.fov;
    cam.near = clamp(s.dist * 0.04, 0.004, 1.0);
    cam.far = 12000;
    cam.updateProjectionMatrix();
    // Im Draufblick zeigt "oben" nach Norden; beim Kippen weich auf die Weltvertikale überblenden
    const tg = new THREE.Vector3(...s.target);
    const fwd = tg.clone().sub(cam.position).normalize();
    const hor = new THREE.Vector3(fwd.x, 0, fwd.z);
    const el = Math.asin(Math.min(1, Math.max(-1, -fwd.y))) * 180 / Math.PI;
    const k = smooth(70, 86, el);
    const north = new THREE.Vector3(0, 0, -1);
    const up = hor.lengthSq() > 1e-6 ? hor.normalize() : north;
    if (k > 0.999) up.copy(north);
    cam.up.copy(new THREE.Vector3(0, 1, 0).lerp(up, k).normalize());
    cam.lookAt(tg);
    cam.updateMatrixWorld();
    return s;
  }

  // Bildschirmprojektion der Station für die 2D-Ebene (Kamera eingefroren ab 15,0 s)
  projectStation(t) {
    const cam = this.w.camera, st = this.w.park.station;
    this.pose(Math.min(t, 14.999));
    const proj = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * 1920, (1 - (p.y * 0.5 + 0.5)) * 1080, p.z]; };
    const b = st.body.position, hw = 3.0, hh = 1.3, hd = 1.25;
    const P = (x, y, z) => proj(new THREE.Vector3(b.x + x, b.y + y, b.z + z));
    return {
      stationDot: proj(new THREE.Vector3(b.x + 1.6, 1.3, b.z + 0.3)),
      stationFront: [P(-hw, hh, hd), P(hw, hh, hd), P(hw, -hh, hd), P(-hw, -hh, hd)],
      stationBack: [P(-hw, hh, -hd), P(hw, hh, -hd), P(hw, -hh, -hd), P(-hw, -hh, -hd)],
    };
  }

  // Szene 6b und 7: Speicher-Planungsszenario, Schlussbild
  updateLate(t) {
    const w = this.w, cam = w.camera;
    this.data.group.visible = false;
    this.bess.set(76.0, t);
    const st = w.park.station; st.edges.material.opacity = 0;
    const fin = 1 - ease.inOutSine(prog(70.95, 71.6, t));
    const fout = ease.inOutSine(prog(84.45, 85.1, t));
    w.grade.uniforms.uFade.value = Math.max(fin, fout);
    w.bloom.strength = 0.0;
    const proj = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * 1920, (1 - (p.y * 0.5 + 0.5)) * 1080, p.z]; };
    this.info.bessScreen = proj(this.bess.center.clone().add(new THREE.Vector3(0, 2, 0)));
    this.info.sunScreen = proj(cam.position.clone().addScaledVector(w.sunDir, 5000));
  }

  // Zielrechteck des Lageplans im Draufblick (Bildschirmkoordinaten)
  planRect() {
    this.pose(71.0);
    const cam = this.w.camera;
    const P = (x, z) => { const p = new THREE.Vector3(x, 0, z).project(cam); return [(p.x * 0.5 + 0.5) * 1920, (1 - (p.y * 0.5 + 0.5)) * 1080]; };
    const a = P(FENCE.x0 - 4, FENCE.z0 - 4), b = P(FENCE.x1 + 4, FENCE.z1 + 4);
    return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
  }

  update(t) {
    const w = this.w, cam = w.camera, d = this.data;
    this.pose(t);

    if (t >= 50) { this.updateLate(t); return; }
    d.group.visible = true; this.bess.group.visible = false;
    // --- Datenstrom ---
    const H = d.hero;
    const L = this.heroLen(t);
    H.setDraw(L / H.len);
    H.line.visible = t >= 11.0 && L > 0.002;
    const head = L > 0 ? H.pointAt(L) : H.pointAt(0);
    const dotIn = smooth(10.75, 11.15, t);
    d.heroDot.position.copy(head); d.heroCore.position.copy(head);
    const pulse = 1 + 0.08 * Math.sin(t * 9.0);
    d.heroDot.scale.setScalar(0.06 * dotIn * pulse); d.heroCore.scale.setScalar(0.014 * dotIn);
    d.heroDot.visible = d.heroCore.visible = t >= 10.75;
    d.heroDot.material.opacity = d.heroCore.material.opacity = dotIn;

    // weitere Datenquellen: Sensor und Wechselrichter-Stränge
    const others = [d.sensor, ...d.invLines];
    others.forEach((pl, i) => {
      const a = 12.55 + i * 0.1, b = a + 1.25;
      const f = ease.inOutCubic(prog(a, b, t));
      pl.setDraw(f);
      pl.mat.opacity = pl.baseOpacity * smooth(a, a + 0.25, t);
    });
    // Linien bleiben sichtbar; Ankunft in der Station lässt die Station glühen
    const arrive = smooth(13.85, 14.2, t);
    const st = w.park.station;
    d.stationGlow.position.set(st.body.position.x + 1.6, 1.3, st.body.position.z + 0.3);
    d.stationGlow.scale.setScalar(0.09 * arrive);
    d.stationGlow.visible = arrive > 0;

    // Abblende auf Navy; die Stationskontur übernimmt die 2D-Ebene
    st.edges.material.opacity = 0;
    w.grade.uniforms.uFade.value = Math.max(1 - ease.inOutSine(prog(0.0, 0.8, t)), ease.inOutSine(prog(14.5, 14.98, t)));
    w.bloom.strength = 0.0;

    // Bildschirmposition des Kopfpunkts für die 2D-Ebene
    const proj = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * 1920, (1 - (p.y * 0.5 + 0.5)) * 1080, p.z]; };
    this.info.heroScreen = proj(head);
  }
}
