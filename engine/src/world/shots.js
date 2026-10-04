import { shot } from './rig.js';
import { HERO, STATION, BESS, FIELD, tablePoint } from './layout.js';

// Kameraeinstellungen der 3D-Passagen. Zeiten in Sekunden der Gesamttimeline.

const heroStart = tablePoint(HERO.x, HERO.z, 0.47031, 0.74);
const heroMid = tablePoint(HERO.x, HERO.z, 0.47031, 0.56);
export const HERO_START = heroStart;

// Szene 1 und 2: Luftbild -> Sturzflug in die Zellstruktur -> Datenstrom -> Station
export const shotA = shot({
  target: [[0, [150, 0, 45]], [7.6, [190, 0.4, 64]], [9.5, [211.6, 1.55, 79.4]], [10.75, heroStart]],
  az: [[0, 32], [7.6, 20], [10.75, 3]],
  el: [[0, 13], [7.6, 18], [9.5, 31], [10.75, 47]],
  dist: [[0, 210], [7.6, 130], [9.3, 30], [10.25, 2.4], [10.75, 0.5]],
  fov: [[0, 38], [8.0, 40], [10.75, 44]],
});

// Makrofahrt: Ziel folgt dem roten Datenpunkt (wird im Director gesetzt)
export const macro = { az: [[10.75, 3], [12.35, -5]], el: [[10.75, 47], [12.35, 53]], dist: [[10.75, 0.5], [12.35, 0.44]], fov: 44 };

export const STATION_DOOR = [STATION.x + 0.4, 1.25, STATION.z + STATION.d / 2];
export function shotB(lowEdge) {
  return shot({
    target: [[12.35, lowEdge], [13.55, [238, 0.5, 92]], [15.0, STATION_DOOR]],
    az: [[12.35, -5], [13.55, -20], [15.0, -8]],
    el: [[12.35, 53], [13.55, 38], [15.0, 9]],
    dist: [[12.35, 0.44], [12.95, 6], [13.55, 48], [15.0, 4.6]],
    fov: [[12.35, 44], [13.55, 40], [15.0, 40]],
  });
}

// Szene 6b: Draufblick (deckungsgleich mit dem Lageplan) -> Schrägluftbild mit Speicherfläche
export const TOPDOWN = { target: [0, 0, 0], dist: 640, fov: 30 };
export const shotC = shot({
  target: [[70.5, [0, 0, 0]], [71.35, [0, 0, 0]], [75.8, [205, 0, 58]], [80.0, [232, 0, 64]]],
  az: [[70.5, 0], [71.35, 0], [75.8, 40], [80.0, 31]],
  el: [[70.5, 90], [71.35, 90], [75.8, 27], [80.0, 23]],
  dist: [[70.5, 640], [71.35, 640], [75.8, 300], [80.0, 235]],
  fov: [[70.5, 30], [71.35, 30], [75.8, 38], [80.0, 38]],
});
// Szene 7: Schlussbild Richtung tief stehende Sonne
export const shotD = shot({
  target: [[80.0, [232, 0, 64]], [82.4, [150, 62, 30]], [85.2, [118, 81, 18]]],
  az: [[80.0, 31], [82.4, 41], [85.2, 45]],
  el: [[80.0, 23], [82.4, 1], [85.2, -4]],
  dist: [[80.0, 235], [82.4, 285], [85.2, 300]],
  fov: [[80.0, 38], [82.4, 40], [85.2, 40]],
});
