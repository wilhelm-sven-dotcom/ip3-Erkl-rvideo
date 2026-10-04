// Kamera-Rig: Ziel (target), Blickrichtung über Azimut/Elevation und Abstand werden als
// Keyframes beschrieben und mit monotonen kubischen Hermite-Splines interpoliert. Der Abstand
// wird logarithmisch interpoliert; so wirkt ein Flug vom Luftbild bis in die Zellstruktur
// wie eine gleichmäßige, ruhige Bewegung.

// Monotone kubische Interpolation (Fritsch-Carlson) für Stützstellen [[t, v], ...]
export function mono(keys) {
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  // Start und Ende weich (Tangente 0), damit Einstellungen sanft beginnen und enden
  if (keys.easeIn !== false) m[0] = 0;
  if (keys.easeOut !== false) m[n - 1] = 0;
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], s = (t - xs[i]) / h;
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}
export const monoV = (keys) => {
  const fx = mono(keys.map((k) => [k[0], k[1][0]])), fy = mono(keys.map((k) => [k[0], k[1][1]])), fz = mono(keys.map((k) => [k[0], k[1][2]]));
  return (t) => [fx(t), fy(t), fz(t)];
};

// Einstellung aus Keyframes: { target: [[t,[x,y,z]]...], az: [[t,deg]], el: [[t,deg]], dist: [[t,m]], fov: [[t,deg]], roll }
export function shot(def) {
  const target = monoV(def.target);
  const az = mono(def.az), el = mono(def.el);
  const logd = mono(def.dist.map(([t, d]) => [t, Math.log(d)]));
  const fov = mono(def.fov);
  return (t) => {
    const tg = target(t), a = (az(t) * Math.PI) / 180, e = (el(t) * Math.PI) / 180, d = Math.exp(logd(t));
    const pos = [tg[0] + Math.sin(a) * Math.cos(e) * d, tg[1] + Math.sin(e) * d, tg[2] + Math.cos(a) * Math.cos(e) * d];
    return { pos, target: tg, fov: fov(t), dist: d };
  };
}
