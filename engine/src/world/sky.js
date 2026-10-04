import * as THREE from 'three';

// Eigener, ruhiger Himmel: klarer Verlauf vom dunstigen Horizont zum satten Zenitblau,
// Sonnenscheibe mit Halo. Volle Kontrolle über Farbe, damit Spiegelungen in den Modulen
// ein sauberes Blau zeigen statt eines milchigen Weiß.

export function createSky() {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uZenith: { value: new THREE.Color('#1d4e9e') },
    uMid: { value: new THREE.Color('#5d8fd0') },
    uHorizon: { value: new THREE.Color('#c3d6ea') },
    uGround: { value: new THREE.Color('#5b6650') },
    uSunCol: { value: new THREE.Color('#fff2dc') },
    uIntensity: { value: 1.0 },
    uSunSize: { value: 1.0 },
    uWarm: { value: 0.0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uZenith, uMid, uHorizon, uGround, uSunCol;
      uniform float uIntensity, uSunSize, uWarm;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col;
        if (h >= 0.0) {
          float a = pow(h, 0.42);
          col = mix(uHorizon, uMid, smoothstep(0.0, 0.55, a));
          col = mix(col, uZenith, smoothstep(0.45, 1.0, a));
        } else {
          col = mix(uHorizon * 0.8, uGround, smoothstep(0.0, 0.25, -h));
        }
        // warme Horizontfärbung bei tiefer Sonne
        float sd = max(dot(d, uSunDir), 0.0);
        vec3 warmCol = vec3(1.0, 0.72, 0.48);
        col = mix(col, col * warmCol * 1.25, uWarm * (1.0 - smoothstep(0.0, 0.35, abs(h))) * (0.35 + 0.65 * pow(sd, 3.0)));
        // Halo und Sonnenscheibe
        float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
        float halo = exp(-ang * 9.0) * 0.55 + exp(-ang * 2.6) * 0.18;
        col += uSunCol * halo;
        float r = 0.0050 * uSunSize;
        float disc = 1.0 - smoothstep(r * 0.85, r, ang);
        col += uSunCol * disc * 60.0;
        gl_FragColor = vec4(col * uIntensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.scale.setScalar(9000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms, mat };
}
