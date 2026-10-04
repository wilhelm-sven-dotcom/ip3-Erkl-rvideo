// Geometrie des Beispielparks. Wird von der 3D-Welt und vom 2D-Lageplan gemeinsam genutzt,
// damit der Übergang Lageplan -> Luftbild exakt deckungsgleich ist.
// Koordinaten: x = Osten, y = oben, z = Süden (Meter). Module zeigen nach Süden (+z).

export const MOD = { w: 1.134, h: 2.278, gap: 0.02, wp: 585 };
export const TABLE = {
  nx: 14, ny: 2,
  w: 14 * MOD.w + 13 * MOD.gap,   // 16,136 m
  d: 2 * MOD.h + MOD.gap,         // 4,576 m (schräg)
  tilt: (20 * Math.PI) / 180,
  low: 0.8,                       // Höhe Unterkante
};
TABLE.cy = TABLE.low + (TABLE.d / 2) * Math.sin(TABLE.tilt);
TABLE.depth = TABLE.d * Math.cos(TABLE.tilt);

export const ROWS = 20, COLS = 15, PITCH = 9.2, COLPITCH = TABLE.w + 0.6, ROAD_NS = 8, ROAD_EW = 6;
const blockW = COLS * COLPITCH - 0.6;
export const FIELD = { x0: -(blockW + ROAD_NS / 2), x1: blockW + ROAD_NS / 2 };
const zSpan = (ROWS - 1) * PITCH + ROAD_EW;
export const Z0 = zSpan / 2; // Zeile 0 (Süden)
FIELD.z0 = -Z0 - TABLE.depth / 2; // Nordkante
FIELD.z1 = Z0 + TABLE.depth / 2;  // Südkante

export function rowZ(r) { return Z0 - r * PITCH - (r >= ROWS / 2 ? ROAD_EW : 0); }
export function colX(block, c) {
  return block === 0
    ? FIELD.x0 + TABLE.w / 2 + c * COLPITCH
    : ROAD_NS / 2 + TABLE.w / 2 + c * COLPITCH;
}

export const tables = [];
for (let r = 0; r < ROWS; r++)
  for (let b = 0; b < 2; b++)
    for (let c = 0; c < COLS; c++) tables.push({ r, b, c, x: colX(b, c), z: rowZ(r) });

export const FENCE = { x0: FIELD.x0 - 12, x1: FIELD.x1 + 12, z0: FIELD.z0 - 12, z1: FIELD.z1 + 12 };

// Übergabestation mit Schaltschrank (Südostecke, innerhalb des Zauns)
export const STATION = { x: FIELD.x1 - 8.5, z: FIELD.z1 + 6.2, w: 6.0, h: 2.6, d: 2.5 };
export const GATE = { x: STATION.x - 9, z: FENCE.z1 };

// Hero-Tisch für die Kamerafahrt in die Zellstruktur
export const HERO = { r: 1, b: 1, c: 12 };
HERO.x = colX(HERO.b, HERO.c);
HERO.z = rowZ(HERO.r);

// Einstrahlungssensor an der Oberkante des östlichsten Tisches in Reihe 0
export const SENSOR = { r: 0, b: 1, c: COLS - 1 };
SENSOR.x = colX(SENSOR.b, SENSOR.c) + TABLE.w / 2 - 0.35;
SENSOR.z = rowZ(SENSOR.r);

// Fläche für das Speicher-Planungsszenario (östlich der Station, außerhalb des Zauns)
export const BESS = { x0: FENCE.x1 + 14, x1: FENCE.x1 + 58, z0: FIELD.z1 - 40, z1: FIELD.z1 + 4 };

// Zufahrt und Gemeindestraße
export const ROADS = {
  access: { x: GATE.x, z0: FENCE.z1, z1: FENCE.z1 + 70, w: 4.5 },
  county: { z: FENCE.z1 + 70, w: 6.5 },
};

// Punkt auf der Tischoberfläche: u = 0..1 entlang der Tischbreite (West->Ost),
// v = 0..1 entlang der Schräge (Unterkante Süd -> Oberkante Nord), Ergebnis in Weltkoordinaten
export function tablePoint(tx, tz, u, v, lift = 0.0) {
  const lx = (u - 0.5) * TABLE.w;
  const s = (v - 0.5) * TABLE.d; // entlang der Schräge, positiv = nach oben/Norden
  const ct = Math.cos(TABLE.tilt), st = Math.sin(TABLE.tilt);
  const n = [0, ct, st]; // Normale
  return [
    tx + lx + n[0] * lift,
    TABLE.cy + s * st + n[1] * (0.022 + lift),
    tz - s * ct + n[2] * (0.022 + lift),
  ];
}
