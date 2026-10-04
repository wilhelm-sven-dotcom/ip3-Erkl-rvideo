import * as THREE from 'three';
import { createSky } from './sky.js';
import { buildTerrain, buildTrees } from './terrain.js';
import { buildPark } from './park.js';
import { FIELD } from './layout.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Farbkorrektur im linearen HDR-Raum vor dem Tone Mapping: Sättigung, leichte kühle Tönung,
// Vignette. Bewusst zurückhaltend, damit Navy und Akzent-Rot der Overlays tragen.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 0.8 }, uVig: { value: 0.22 }, uTint: { value: new THREE.Vector3(0.985, 1.0, 1.03) },
    uLift: { value: 0.0 }, uFade: { value: 0.0 }, uFadeCol: { value: new THREE.Vector3(0.0045, 0.0102, 0.0467) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uVig; uniform vec3 uTint; uniform float uLift;
    uniform float uFade; uniform vec3 uFadeCol; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat) * uTint;
      vec2 d = vUv - 0.5; d.x *= 1.25;
      c.rgb *= 1.0 - uVig * smoothstep(0.25, 0.85, length(d));
      c.rgb += uLift;
      c.rgb = mix(c.rgb, uFadeCol, uFade);
      gl_FragColor = c;
    }`,
};

// 3D-Welt: Renderer, physikalischer Himmel, Sonne, Umgebungslicht, Nebel für Luftperspektive.

export class World {
  constructor(canvas, W, H) {
    this.W = W; this.H = H;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(1); r.setSize(W, H, false);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.6;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 12000);

    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.setPixelRatio(1); this.composer.setSize(W, H);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.0, 0.5, 0.95);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    // Himmel (eine Shader-Instanz für Szene und Umgebungs-Cubemap)
    this.skyObj = createSky();
    this.scene.add(this.skyObj.mesh);
    this.skyScene = new THREE.Scene();
    const envSkyMesh = new THREE.Mesh(this.skyObj.mesh.geometry, this.skyObj.mat);
    envSkyMesh.scale.setScalar(9000); envSkyMesh.frustumCulled = false;
    this.skyScene.add(envSkyMesh);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.envCache = new Map();

    // Licht
    this.sun = new THREE.DirectionalLight(0xfff4e6, 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(3072, 3072);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x5b6b3f, 0.32);
    this.scene.add(this.hemi);

    this.scene.fog = new THREE.Fog(0xb4cae2, 1400, 9500);

    // Inhalte
    this.terrain = buildTerrain(); this.scene.add(this.terrain);
    this.trees = buildTrees(); this.scene.add(this.trees);
    this.park = buildPark(); this.scene.add(this.park.group);

    this.sunDir = new THREE.Vector3();
    this.setSun(54, 145);
  }

  // Sonnenstand: Elevation und Azimut (Grad, Azimut ab Nord im Uhrzeigersinn)
  setSun(elev, azim) {
    const key = `${elev.toFixed(2)}_${azim.toFixed(2)}`;
    if (this.sunKey === key) return;
    this.sunKey = key;
    const phi = THREE.MathUtils.degToRad(90 - elev), th = THREE.MathUtils.degToRad(azim);
    // Azimut ab Nord (-z) im Uhrzeigersinn über Osten (+x)
    this.sunDir.set(Math.sin(phi) * Math.sin(th), Math.cos(phi), -Math.sin(phi) * Math.cos(th));
    const su = this.skyObj.uniforms;
    su.uSunDir.value.copy(this.sunDir);
    su.uWarm.value = 1 - THREE.MathUtils.smoothstep(elev, 6, 32);
    if (!this.envCache.has(key)) {
      if (this.envCache.size > 6) { for (const [k, v] of this.envCache) { v.dispose(); this.envCache.delete(k); break; } }
      this.envCache.set(key, this.pmrem.fromScene(this.skyScene, 0, 1, 20000).texture);
    }
    this.scene.environment = this.envCache.get(key);
    this.scene.environmentIntensity = 0.7;
    // Lichtfarbe: tiefer stehende Sonne wird wärmer
    const warm = THREE.MathUtils.smoothstep(elev, 8, 45);
    this.sun.color.setRGB(1.0, 0.86 + 0.12 * warm, 0.70 + 0.24 * warm);
    this.sun.intensity = 1.9 + 1.7 * warm;
  }

  // Schattenkamera auf den sichtbaren Bereich ausrichten
  fitShadow(center, radius) {
    const s = this.sun;
    s.target.position.copy(center);
    s.position.copy(center).addScaledVector(this.sunDir, Math.max(400, radius * 3));
    const c = s.shadow.camera;
    // Texel-Snapping gegen Flimmern
    const texel = (2 * radius) / s.shadow.mapSize.x;
    const lx = new THREE.Vector3().crossVectors(this.sunDir, new THREE.Vector3(0, 1, 0)).normalize();
    const ly = new THREE.Vector3().crossVectors(lx, this.sunDir).normalize();
    const px = Math.round(center.dot(lx) / texel) * texel - center.dot(lx);
    const py = Math.round(center.dot(ly) / texel) * texel - center.dot(ly);
    s.position.addScaledVector(lx, px).addScaledVector(ly, py);
    s.target.position.addScaledVector(lx, px).addScaledVector(ly, py);
    c.left = -radius; c.right = radius; c.top = radius; c.bottom = -radius;
    c.near = 1; c.far = Math.max(400, radius * 3) + radius * 2 + 200;
    c.updateProjectionMatrix();
  }

  look(pos, target, fov = 40) {
    const cam = this.camera;
    cam.position.set(...pos); cam.fov = fov; cam.near = Math.max(0.01, Math.min(1, pos[1] * 0.02));
    cam.updateProjectionMatrix(); cam.lookAt(new THREE.Vector3(...target));
  }

  render() {
    const cam = this.camera;
    // Schatten: Mittelpunkt etwas vor der Kamera am Boden
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const h = Math.max(0.3, cam.position.y);
    const dist = Math.min(h / Math.max(0.15, -dir.y), 2500);
    const center = cam.position.clone().addScaledVector(dir, dist * 0.8); center.y = 0;
    const radius = THREE.MathUtils.clamp(dist * 0.9 + 4, 6, 520);
    this.fitShadow(center, radius);
    this.bloom.enabled = this.bloom.strength > 0.001;
    this.composer.render();
  }
}
