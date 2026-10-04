import * as THREE from 'three';
import { MOD, TABLE } from './layout.js';

// PV-Modul-Oberfläche als prozedurales, gefiltertes Muster (Inigo-Quilez-Technik): Rahmen,
// Modulfugen, Halbzellen mit Fasen, Rückseitenfolie, Busbars und Finger. Die Box-Filterung
// über fwidth() sorgt dafür, dass Details aus der Luft sauber verschwimmen und in der
// Makroaufnahme gestochen scharf sind.

const GLSL_PATTERN = /* glsl */ `
varying vec2 vMUv;
uniform float uHeroGlow;
uniform vec2 uHeroUv;

float pInt(float x, float P, float g){ return floor(x/P)*g + min(mod(x,P), g); }
// gefilterter Pulszug: Breite g, Periode P, Pulsbeginn bei x = o
float fpulse(float x, float P, float g, float o, float w){
  x -= o; w = max(w, 1e-5);
  return (pInt(x + 0.5*w, P, g) - pInt(x - 0.5*w, P, g)) / w;
}
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
`;

const GLSL_MAIN = /* glsl */ `
  // ---- Modulraster in Millimetern ----
  vec2 tmm = vMUv * vec2(${(TABLE.w * 1000).toFixed(1)}, ${(TABLE.d * 1000).toFixed(1)});
  vec2 fw = max(fwidth(tmm), vec2(1e-4));
  float Px = ${((MOD.w + MOD.gap) * 1000).toFixed(1)};
  float Py = ${((MOD.h + MOD.gap) * 1000).toFixed(1)};
  // Fuge zwischen Modulen (20 mm) und Rahmenlippe (je 12 mm sichtbar)
  float gx = fpulse(tmm.x, Px, 20.0, ${(MOD.w * 1000).toFixed(1)}, fw.x);
  float gy = fpulse(tmm.y, Py, 20.0, ${(MOD.h * 1000).toFixed(1)}, fw.y);
  float gapC = 1.0 - (1.0-gx)*(1.0-gy);
  float fx = fpulse(tmm.x, Px, 44.0, ${(MOD.w * 1000 - 12).toFixed(1)}, fw.x);
  float fy = fpulse(tmm.y, Py, 44.0, ${(MOD.h * 1000 - 12).toFixed(1)}, fw.y);
  float frameC = clamp((1.0 - (1.0-fx)*(1.0-fy)) - gapC, 0.0, 1.0);

  // lokale Modulkoordinaten
  vec2 m = vec2(mod(tmm.x, Px), mod(tmm.y, Py));
  float fwm = max(fw.x, fw.y);
  // Zellspalten: 6 x 182 mm, Fuge 2,5 mm
  float csx = fpulse(m.x, 184.5, 2.5, 12.25, fw.x);
  // Halbzellen-Zeilen: 2 x 12 Zeilen à 91 mm, Fuge 2 mm, Mittelstreifen 16 mm, Randstreifen 5 mm
  float csyL = fpulse(m.y, 93.0, 2.0, 108.0, fw.y) * step(m.y, 1131.0);
  float csyU = fpulse(m.y, 93.0, 2.0, 1238.0, fw.y) * step(1147.0, m.y);
  float mid = fpulse(tmm.y, Py, 16.0, 1131.0, fw.y);
  float edB = fpulse(tmm.y, Py, 5.0, 12.0, fw.y);
  float edT = fpulse(tmm.y, Py, 5.0, 2261.0, fw.y);
  float back = 1.0 - (1.0-csx)*(1.0-max(csyL, csyU))*(1.0-mid)*(1.0-edB)*(1.0-edT);

  // Zellindex und Fasen an den Außenecken jedes Zellpaars (nur in Nahaufnahme)
  float yr = m.y - 17.0;
  float upper = step(1130.0, yr);
  float yy = yr - upper*1130.0;
  float col = floor((m.x - 14.75) / 184.5);
  float cx = (m.x - 14.75) - col*184.5;
  float row = floor(yy / 93.0);
  float cy = yy - row*93.0;
  float fineK = 1.0 - smoothstep(1.5, 4.0, fwm);
  float dEdge = (mod(row, 2.0) < 0.5) ? cy : (91.0 - cy);
  float ch = 7.5 - dEdge;
  float cham = (step(cx, ch) + step(182.0 - cx, ch)) * fineK * step(0.0, yr) * step(yr, 2244.0);
  back = clamp(back + cham * (1.0 - back), 0.0, 1.0);

  // Busbars (16 Drähte je Zelle, vertikal) und Finger (horizontal)
  float bus = fpulse(cx, 11.375, 0.42, 5.48, fw.x) * (1.0 - back);
  float fin = fpulse(cy, 1.3, 0.07, 0.6, fw.y) * (1.0 - back) * (1.0 - bus);
  // Querverbinder im Mittelstreifen und an den Enden der Zellmatrix
  float rib = (fpulse(yr, 10000.0, 4.0, 1117.0, fw.y) + fpulse(yr, 10000.0, 4.0, 1123.0, fw.y)
             + fpulse(yr, 10000.0, 5.0, -9.0, fw.y) + fpulse(yr, 10000.0, 5.0, 2248.0, fw.y)) * (1.0 - csx);
  rib = clamp(rib, 0.0, 1.0) * fineK;

  // Zellfarbe mit leichter Streuung je Zelle und feinem Kristallglanz in Nahaufnahme
  vec2 cid = vec2(floor(tmm.x / 184.5), floor(tmm.y / 93.0));
  float cvar = h21(cid) * 0.08 - 0.04;
  float spark = (h21(floor(tmm * 1.7)) - 0.5) * 0.06 * fineK;
  vec3 cellCol = vec3(0.012, 0.020, 0.058) * (1.0 + cvar + spark);
  vec3 backCol = vec3(0.74, 0.75, 0.77);
  vec3 metalCol = vec3(0.78, 0.79, 0.81);
  vec3 frameCol = vec3(0.72, 0.74, 0.76);
  vec3 gapCol = vec3(0.012, 0.014, 0.018);

  vec3 col3 = cellCol;
  col3 = mix(col3, metalCol, clamp(bus * 0.9 + fin * 0.55, 0.0, 1.0));
  col3 = mix(col3, backCol, back);
  col3 = mix(col3, metalCol, rib);
  float glass = 1.0 - clamp(frameC + gapC, 0.0, 1.0);
  col3 = mix(col3, frameCol, frameC);
  col3 = mix(col3, gapCol, gapC);
  diffuseColor.rgb = col3;

  float metal = clamp(bus + fin * 0.6 + rib, 0.0, 1.0) * glass + frameC;
  metalnessFactor = clamp(metal * 0.7 + frameC * 0.3, 0.0, 1.0);
  roughnessFactor = mix(0.68, 0.5, metal);
  roughnessFactor = mix(roughnessFactor, 0.85, back * glass);
  float vGlass = glass;
`;

export function createModuleMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.55,
    dithering: true,
  });
  mat.userData.uniforms = { uHeroGlow: { value: 0 }, uHeroUv: { value: new THREE.Vector2(0.5, 0.5) } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_PATTERN)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + GLSL_MAIN)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.clearcoat *= vGlass;');
  };
  mat.customProgramCacheKey = () => 'pvmodule-v3';
  return mat;
}
