import { World } from './world/world.js';
import { Director } from './world/director.js';
import { Overlay } from './overlay/index.js';
import cues from './cues.json' with { type: 'json' };

// Einstieg der Render-Stage. Der Renderer ruft window.seek(t) für jedes Einzelbild auf.

const params = new URLSearchParams(location.search);
const Q = parseFloat(params.get('q') || '1');
const W = 1920, H = 1080;

const canvas = document.getElementById('gl');
const ov = document.getElementById('ov');

let world = null, director = null, overlay = null, planRect = null, sunEnd = null;
async function init() {
  await document.fonts.ready;
  world = new World(canvas, Math.round(W * Q), Math.round(H * Q));
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  director = new Director(world);
  overlay = new Overlay(ov);
  planRect = director.planRect();
  director.update(84.9); sunEnd = director.info.sunScreen;
  window.world = world; window.director = director; window.overlay = overlay;
  window.ready = true;
}

// Debug-Hilfe für Standbilder: Kamera frei setzen
window.debugLook = (pos, target, fov, elev, azim) => {
  if (elev !== undefined) world.setSun(elev, azim);
  world.look(pos, target, fov);
  world.render();
  return true;
};

window.seek = async (t) => {
  const on3d = director.active(t);
  canvas.style.visibility = on3d ? 'visible' : 'hidden';
  const info = { planRect, sunScreen: sunEnd };
  if (t > 14.4 && t < 15.6) Object.assign(info, director.projectStation(t));
  if (on3d) { director.update(t); world.render(); if (t > 70) info.bessScreen = director.info.bessScreen; }
  overlay.update(t, info);
  return true;
};

init().catch((e) => { console.error(e); window.initError = String(e && e.stack || e); });
