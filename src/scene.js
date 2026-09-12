// La scène : un parking de nuit, une allée centrale, des voitures garées de
// chaque côté, des lampadaires, un sol mouillé qui reflète, et une caméra qui
// avance le long de l'allée au rythme du défilement.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ChromaticAberrationEffect,
  NoiseEffect, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, Effect,
} from 'postprocessing';
import { gsap } from 'gsap';
import { loadCarTypes, buildCars, buildFlashes } from './cars.js';
import { buildProceduralCars } from './cars-procedural.js';

export const LOT = {
  aisleHalf: 6.6, bayPitch: 5.5, firstBayZ: -8, lastBayZ: -158,
  lampX: 11.8, lampHeight: 7.2, lampPitch: 22, lampFirstZ: 12, lampLastZ: -160,
  gateZ: 7, signZ: -178, signY: 9.2,
};

const FOG = 0x0b0b0d;

// Une loupe discrète sous le curseur : l'image entière réagit au pointeur, pas
// seulement le sol.
class LensEffect extends Effect {
  constructor() {
    super('LensEffect', /* glsl */ `
      uniform vec2 uCursor; uniform float uAspect; uniform float uStrength;
      void mainUv(inout vec2 uv) {
        vec2 d = uv - uCursor;
        float r = length(d * vec2(uAspect, 1.0));
        uv -= d * uStrength * smoothstep(0.26, 0.0, r);
      }
    `, {
      uniforms: new Map([
        ['uCursor', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ['uAspect', new THREE.Uniform(1)],
        ['uStrength', new THREE.Uniform(0.045)],
      ]),
    });
  }
}

// ---------------------------------------------------------------------------
// Textures procédurales
// ---------------------------------------------------------------------------

function hash(x, y, o) {
  const n = Math.sin(x * 127.1 + y * 311.7 + o * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, freq = 8, norm = 0;
      for (let o = 0; o < 4; o++) {
        const fx = (x / size) * freq, fy = (y / size) * freq;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const x1 = (x0 + 1) % freq, y1 = (y0 + 1) % freq;
        const a = hash(x0, y0, o), b = hash(x1, y0, o), c = hash(x0, y1, o), d = hash(x1, y1, o);
        v += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
        norm += amp; amp *= 0.5; freq *= 2;
      }
      const g = Math.round((v / norm) * 255);
      const i = (y * size + x) * 4;
      data[i] = g; data[i + 1] = g; data[i + 2] = g; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const coneTexture = () => canvasTexture(4, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.03)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
});

const discTexture = () => canvasTexture(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
});

function textTexture(text, { font = '600 150px "Familjen Grotesk"', color = '#e6b8a2', tracking = 0.24, w = 1024, h = 256, size = 150 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    const chars = Array.from(text);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * size * (chars.length - 1);
    let x = (w - total) / 2;
    chars.forEach((ch, i) => { ctx.fillText(ch, x, h / 2 + size * 0.04); x += widths[i] + tracking * size; });
  });
}

// ---------------------------------------------------------------------------
// Le sol mouillé : un Reflector de three, avec un shader à nous. Le reflet est
// masqué par un bruit (flaques), légèrement déformé, et le curseur y fait des
// ondes. Le brouillard est recalculé à la main, un ShaderMaterial n'en a pas.
// ---------------------------------------------------------------------------

function wetShader() {
  return {
    name: 'WetAsphalt',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      tNoise: { value: null },
      uFogColor: { value: new THREE.Color(FOG) },
      uFogDensity: { value: 0.02 },
      uCursor: { value: new THREE.Vector3(0, 0, 9999) },
      uTime: { value: 0 },
      uWet: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vUv = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform sampler2D tNoise;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uCursor;
      uniform float uTime;
      uniform float uWet;
      varying vec4 vUv;
      varying vec3 vWorld;
      void main() {
        vec2 nuv = vWorld.xz * 0.05;
        float n1 = texture2D(tNoise, nuv).r;
        float n2 = texture2D(tNoise, nuv * 3.1 + vec2(0.37, 0.11)).r;
        float n3 = texture2D(tNoise, nuv * 11.0).r;
        float wet = smoothstep(0.38, 0.72, n1 * 0.65 + n2 * 0.35) * uWet;
        float d = distance(vWorld.xz, uCursor.xz);
        float ripple = sin(d * 5.0 - uTime * 4.0) * exp(-d * 0.7) * 0.03;
        vec2 distort = (vec2(n3 - 0.5, n2 - 0.5) * 0.02) * (1.0 - wet * 0.7) + ripple;
        vec4 puv = vUv;
        puv.xy += distort * puv.w;
        vec3 refl = texture2DProj(tDiffuse, puv).rgb;
        if (any(isnan(refl)) || any(isinf(refl))) refl = vec3(0.0);
        refl = clamp(refl, 0.0, 12.0);
        vec3 asphalt = color * (0.7 + 0.6 * n3) * (0.85 + 0.3 * n1);
        float strength = mix(0.16, 0.92, wet);
        vec3 col = asphalt + refl * strength;
        col += vec3(0.9, 0.72, 0.62) * exp(-d * d * 0.32) * 0.14;
        float dist = distance(vWorld, cameraPosition);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  };
}

// ---------------------------------------------------------------------------
// Poussière dans la lumière : des points qui dérivent, visibles près de la
// caméra, invisibles plus loin.
// ---------------------------------------------------------------------------

function makeParticles(count) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = 0.2 + Math.random() * 7;
    pos[i * 3 + 2] = 14 - Math.random() * 200;
    size[i] = 1.5 + Math.random() * 3.5;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color(0xe6b8a2) } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aPhase;
      uniform float uTime; uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.5 + aPhase) * 0.3;
        p.x += cos(uTime * 0.35 + aPhase * 1.7) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = max(-mv.z, 0.5);
        gl_PointSize = min(aSize * uPixelRatio * (34.0 / dist), aSize * uPixelRatio * 5.0);
        vAlpha = smoothstep(40.0, 4.0, dist) * smoothstep(1.2, 4.5, dist) * (0.45 + 0.55 * sin(uTime * 1.1 + aPhase * 3.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha; uniform vec3 uColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vAlpha * 0.55;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
  return new THREE.Points(geo, mat);
}

// ---------------------------------------------------------------------------

export function createScene(canvas, { lite = false, reduced = false, touch = false, onProgress = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(FOG, 1);
  // Résolution par budget de pixels : un grand écran ne coûte pas plus qu'un petit.
  const pixelBudget = lite ? 1.0e6 : 1.9e6;
  const pickDpr = () => Math.min(window.devicePixelRatio || 1, lite ? 1.3 : 1.5, Math.sqrt(pixelBudget / (window.innerWidth * window.innerHeight)));
  let dpr = pickDpr();
  let degraded = false;
  const glCtx = renderer.getContext();
  const dbgInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbgInfo ? String(glCtx.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)) : '';
  const appleGpu = /apple/i.test(gpuName);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, lite ? 0.024 : 0.021);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(0, 1.7, 26);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  // Lumières : un ciel très sombre, une lune froide pour dessiner les
  // silhouettes, quatre lampadaires « vivants » réaffectés aux plus proches de
  // la caméra, et la lampe du curseur.
  const hemi = new THREE.HemisphereLight(0x3a2830, 0x06060a, 0.6);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x7c86a8, 0.55);
  moon.position.set(-18, 24, -40);
  scene.add(moon);
  const lampLights = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xffd3a3, 0, 36, 2);
    scene.add(l); lampLights.push(l);
  }
  const cursorLight = new THREE.PointLight(0xe6b8a2, touch ? 0 : (lite ? 24 : 40), 20, 2);
  cursorLight.position.set(0, 1.4, 9999);
  scene.add(cursorLight);

  // Sol
  const noiseTex = valueNoiseTexture(256);
  const floorGeo = new THREE.PlaneGeometry(110, 300);
  let reflector = null, floor;
  if (!lite) {
    reflector = new Reflector(floorGeo, {
      clipBias: 0.004,
      textureWidth: Math.round(window.innerWidth * dpr * 0.35),
      textureHeight: Math.round(window.innerHeight * dpr * 0.35),
      color: 0x0e0e11,
      shader: wetShader(),
    });
    const u = reflector.material.uniforms;
    u.tNoise.value = noiseTex;
    u.uFogDensity.value = scene.fog.density;
    floor = reflector;
  } else {
    noiseTex.repeat.set(40, 110);
    floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
      color: 0x07070a, roughness: 0.55, metalness: 0.05, roughnessMap: noiseTex, envMapIntensity: 0.12,
    }));
  }
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -80);
  scene.add(floor);

  // Une lueur d'horizon, hors brouillard, pour que le ciel ne soit pas un mur noir.
  const skyTex = canvasTexture(4, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#07070a'); g.addColorStop(0.36, '#0b0b0d'); g.addColorStop(0.44, '#150f0e'); g.addColorStop(0.48, '#2a1a15'); g.addColorStop(0.5, '#3a2419'); g.addColorStop(0.515, '#1e1411'); g.addColorStop(0.6, '#0b0b0d'); g.addColorStop(1, '#0b0b0d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 24), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(0, 0.6, -80);
  sky.renderOrder = -10;
  scene.add(sky);

  // Marquage au sol des places
  const lineCount = Math.round((LOT.firstBayZ - LOT.lastBayZ) / LOT.bayPitch) + 2;
  const lines = new THREE.InstancedMesh(new THREE.PlaneGeometry(5.4, 0.1), new THREE.MeshBasicMaterial({ color: 0x3d352f }), lineCount * 2);
  {
    const d = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < lineCount; i++) {
      const z = LOT.firstBayZ + LOT.bayPitch / 2 - i * LOT.bayPitch;
      for (const side of [-1, 1]) {
        d.position.set(side * (LOT.aisleHalf + 2.7), 0.012, z);
        d.rotation.set(-Math.PI / 2, 0, 0);
        d.updateMatrix();
        lines.setMatrixAt(k++, d.matrix);
      }
    }
    lines.instanceMatrix.needsUpdate = true;
  }
  scene.add(lines);

  // Lampadaires : mât, tête lumineuse, cône de lumière dans le brouillard,
  // flaque de lumière au sol.
  const lampPositions = [];
  for (let z = LOT.lampFirstZ; z >= LOT.lampLastZ; z -= LOT.lampPitch) {
    for (const side of [-1, 1]) lampPositions.push({ x: side * LOT.lampX, z, side });
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2b31, roughness: 0.6, metalness: 0.6 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.1, LOT.lampHeight, 8), poleMat, lampPositions.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), poleMat, lampPositions.length);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.16, 0.34), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.05, 1.45), toneMapped: false }), lampPositions.length);
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0xffd2a4) }, uOpacity: { value: lite ? 1.0 : 1.4 }, uFogDensity: { value: scene.fog.density } },
    vertexShader: /* glsl */ `
      varying float vV; varying float vFres; varying float vDist; varying vec3 vTint;
      void main() {
        vec3 p = position; vec3 n = normal;
        #ifdef USE_INSTANCING
          p = (instanceMatrix * vec4(position, 1.0)).xyz;
          n = mat3(instanceMatrix) * normal;
        #endif
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 tn = normalMatrix * n;
        vec3 vn = tn / max(length(tn), 1e-5);
        vec3 toCam = -mv.xyz / max(length(mv.xyz), 1e-5);
        vFres = clamp(abs(dot(vn, toCam)), 0.0, 1.0);
        vDist = -mv.z;
        vV = uv.y;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uFogDensity;
      varying float vV; varying float vFres; varying float vDist; varying vec3 vTint;
      void main() {
        float g = pow(clamp(vV, 0.0, 1.0), 2.2);
        float a = g * pow(vFres, 1.6) * uOpacity;
        if (a != a) a = 0.0;
        a *= exp(-uFogDensity * uFogDensity * vDist * vDist);
        gl_FragColor = vec4(uColor * vTint * a, a);
      }
    `,
  });
  const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(3.6, LOT.lampHeight, 32, 1, true), coneMat, lampPositions.length);
  const discs = new THREE.InstancedMesh(
    new THREE.CircleGeometry(5.2, 40),
    new THREE.MeshBasicMaterial({ map: discTexture(), color: 0xffd2a4, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
    lampPositions.length,
  );
  {
    const d = new THREE.Object3D();
    lampPositions.forEach((p, i) => {
      const hx = p.x - p.side * 1.1; // la tête déborde vers l'allée
      d.position.set(p.x, LOT.lampHeight / 2, p.z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); poles.setMatrixAt(i, d.matrix);
      d.position.set(p.x - p.side * 0.55, LOT.lampHeight - 0.05, p.z); d.updateMatrix(); arms.setMatrixAt(i, d.matrix);
      d.position.set(hx, LOT.lampHeight - 0.1, p.z); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
      d.position.set(hx, LOT.lampHeight / 2 - 0.1, p.z); d.updateMatrix(); cones.setMatrixAt(i, d.matrix);
      d.position.set(hx, 0.02, p.z); d.rotation.set(-Math.PI / 2, 0, 0); d.updateMatrix(); discs.setMatrixAt(i, d.matrix);
      p.hx = hx;
    });
    [poles, arms, heads, cones, discs].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    const white = new THREE.Color(1, 1, 1);
    lampPositions.forEach((_, i) => cones.setColorAt(i, white));
    cones.instanceColor.needsUpdate = true;
  }
  scene.add(poles, arms, heads, cones, discs);
  // Les cônes ne participent pas au reflet : invisibles vus d'en dessous, et
  // c'est le rendu miroir qui les fait dégénérer en NaN.
  if (reflector) {
    const original = reflector.onBeforeRender;
    reflector.onBeforeRender = function (...args) {
      const hide = [cones, particles, discs, lines, sky, ...marks];
      if (flashes) hide.push(flashes);
      hide.forEach((o) => { o.visible = false; });
      original.apply(this, args);
      hide.forEach((o) => { o.visible = true; });
    };
  }

  // L'entrée : une guérite, une barrière qui se lève, un portique « ENTRÉE ».
  const gateGroup = new THREE.Group();
  const boothMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.7, metalness: 0.2 });
  const booth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.7, 2.2), boothMat);
  booth.position.set(-5.4, 1.35, LOT.gateZ - 0.6);
  const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 2.7), boothMat);
  boothRoof.position.set(-5.4, 2.8, LOT.gateZ - 0.6);
  const boothWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.5, 1.0), toneMapped: false }));
  boothWindow.position.set(-4.28, 1.75, LOT.gateZ - 0.6);
  boothWindow.rotation.y = Math.PI / 2;
  const gate = new THREE.Group();
  gate.position.set(-4.0, 1.05, LOT.gateZ);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0xe6b8a2, roughness: 0.4, metalness: 0.3 }));
  arm.position.x = 3.6;
  const armTip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.2, 0.15), toneMapped: false }));
  armTip.position.x = 6.95;
  const armBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.5), boothMat);
  armBase.position.set(-4.0, 0.55, LOT.gateZ);
  gate.add(arm, armTip);
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.0, 8);
  const postL = new THREE.Mesh(postGeo, poleMat); postL.position.set(-4.9, 2.0, LOT.gateZ + 0.8);
  const postR = new THREE.Mesh(postGeo, poleMat); postR.position.set(4.9, 2.0, LOT.gateZ + 0.8);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.16, 0.16), poleMat); beam.position.set(0, 3.95, LOT.gateZ + 0.8);
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2), depthWrite: false }));
  gateSign.position.set(0, 3.2, LOT.gateZ + 0.8);
  const gateSignBack = gateSign.clone(); gateSignBack.rotation.y = Math.PI;
  gateGroup.add(booth, boothRoof, boothWindow, armBase, gate, postL, postR, beam, gateSign, gateSignBack);
  scene.add(gateGroup);

  // L'enseigne au fond de l'allée
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false, color: new THREE.Color(2.6, 2.6, 2.6), depthWrite: false }));
  sign.position.set(0, LOT.signY, LOT.signZ);
  const signWall = new THREE.Mesh(new THREE.BoxGeometry(70, 18, 1), new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.9 }));
  signWall.position.set(0, 9, LOT.signZ - 1.2);
  const signGlow = new THREE.PointLight(0xe6b8a2, 0, 50, 2);
  signGlow.position.set(0, LOT.signY, LOT.signZ + 4);
  scene.add(sign, signWall, signGlow);

  document.fonts.ready.then(() => {
    gateSign.material.map = textTexture('ENTRÉE', { size: 120, font: '600 120px "Familjen Grotesk"', tracking: 0.3, w: 1024, h: 256 });
    gateSign.material.needsUpdate = true;
    gateSignBack.material = gateSign.material;
    sign.material.map = textTexture('CARCLAN', { size: 190, font: '600 190px "Familjen Grotesk"', tracking: 0.28, w: 2048, h: 512 });
    sign.material.needsUpdate = true;
  });

  // Voitures : de vrais modèles, chargés en asynchrone ; les voitures
  // procédurales restent en secours si le fichier ne charge pas.
  let cars = null, flashes = null;
  const lotOpts = { aisleHalf: LOT.aisleHalf, bayPitch: LOT.bayPitch, firstBayZ: LOT.firstBayZ, lastBayZ: LOT.lastBayZ, envMapIntensity: lite ? 1.0 : 1.25, lite };
  const carsReady = loadCarTypes('/models/cars.glb', onProgress)
    .then((lib) => buildCars(lib, lotOpts))
    .catch((err) => { console.warn('Modèles indisponibles, voitures procédurales', err); return buildProceduralCars(lotOpts); })
    .then((built) => {
      cars = built;
      scene.add(cars.group);
      flashes = buildFlashes(cars.specs, { aisleHalf: LOT.aisleHalf, count: lite ? 10 : 18 });
      flashes.material.uniforms.uPixelRatio.value = dpr;
      scene.add(flashes);
    });

  // Le chemin de la caméra
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.7, 3.5),
    new THREE.Vector3(-0.9, 1.7, -18),
    new THREE.Vector3(1.0, 1.8, -46),
    new THREE.Vector3(-0.8, 1.65, -76),
    new THREE.Vector3(0.9, 1.9, -104),
    new THREE.Vector3(-0.3, 2.0, -128),
    new THREE.Vector3(0.2, 2.3, -140),
    new THREE.Vector3(0, 2.9, -151),
    new THREE.Vector3(0, 3.3, -158),
  ], false, 'catmullrom', 0.5);
  const signLook = new THREE.Vector3(0, LOT.signY - 5.6, LOT.signZ);

  // Les « points » de rendez-vous, un par section, du côté opposé au texte.
  const markMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.5, 1.3), toneMapped: false });
  const marks = [1, 2, 3, 4].map((i) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 12, 48, Math.PI * 1.62), markMat);
    ring.rotation.z = Math.PI * 0.62;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), markMat);
    g.add(ring, dot);
    const z = path.getPointAt(i / 5).z;
    const x = i % 2 === 1 ? -3.4 : 3.4;
    g.position.set(x, 2.5, z);
    g.scale.setScalar(0.0001);
    g.userData = { z, i, baseY: 2.5 };
    scene.add(g);
    return g;
  });

  const particles = makeParticles(lite ? 600 : 1100);
  particles.material.uniforms.uPixelRatio.value = dpr;
  scene.add(particles);

  // Post-traitement
  // Pas de MSAA sur le tampon HalfFloat : mesuré ici, il rend l'image noire
  // avec le Reflector qui change de cible en pleine passe. SMAA fait le travail.
  let lensPass = null;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({ intensity: lite ? 0.85 : 1.05, luminanceThreshold: 0.62, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.7, levels: lite ? 5 : 6 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const vignette = new VignetteEffect({ eskil: false, offset: 0.22, darkness: 0.58 });
  // La loupe déforme les UV : elle ne peut pas partager la passe du bloom
  // (convolution), elle a la sienne, juste avant.
  const lens = !lite && !touch ? new LensEffect() : null;
  if (lens) { lensPass = new EffectPass(camera, lens); composer.addPass(lensPass); }
  const effects = [bloom];
  if (!lite) effects.push(new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0008, 0.0008), radialModulation: true, modulationOffset: 0.4 }));
  effects.push(tone, vignette);
  let noise = null;
  if (!lite) { noise = new NoiseEffect({ premultiply: true }); noise.blendMode.opacity.value = 0.05; effects.push(noise); }
  const mainPass = new EffectPass(camera, ...effects);
  composer.addPass(mainPass);
  let smaaPass = null;
  if (!lite) { smaaPass = new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM })); composer.addPass(smaaPass); }
  composer.setSize(window.innerWidth, window.innerHeight);

  // État
  const st = {
    progress: 0, target: 0, intro: 1, time: 0,
    pointer: new THREE.Vector2(0, 0), ps: new THREE.Vector2(0, 0),
    cursor: new THREE.Vector3(0, 0, 9999), cursorTarget: new THREE.Vector3(0, 0, 9999), cursorSeen: false,
    vel: 0, velTarget: 0, t: 0, endK: 0,
  };
  let stations = null;
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  const fogBase = scene.fog.density;
  const ray = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const color = new THREE.Color();

  // Où regarder selon l'avancement : vers les voitures du côté opposé au texte.
  const LOOKS = [[0, 0], [0.2, -3.2], [0.4, 3.2], [0.6, -3.2], [0.8, 2.4], [1, 0]];
  function lookAtT(t) {
    for (let i = 0; i < LOOKS.length - 1; i++) {
      const [t0, v0] = LOOKS[i], [t1, v1] = LOOKS[i + 1];
      if (t <= t1) {
        const span = t1 - t0;
        return v0 + (v1 - v0) * THREE.MathUtils.smoothstep(t, t0 + span * 0.2, t1 - span * 0.2);
      }
    }
    return 0;
  }
  // Des gares : la caméra s'arrête pendant qu'une section se lit, et file
  // entre deux. Les bornes viennent de la mise en page (main.js).
  // Pendant qu'une section se lit, la caméra continue d'avancer doucement
  // (DRIFT) : un arrêt complet donne l'impression que le défilement bloque.
  const DRIFT = 0.07;
  const holdA = (sta) => Math.max(0, sta.t - DRIFT * 0.5);
  const holdB = (sta) => Math.min(1, sta.t + DRIFT * 0.5);
  function stationT(p) {
    if (!stations) return p;
    for (let i = 0; i < stations.length; i++) {
      const sta = stations[i];
      if (p <= sta.p1) {
        if (p >= sta.p0 || i === 0) {
          const k = THREE.MathUtils.clamp((p - sta.p0) / Math.max(1e-6, sta.p1 - sta.p0), 0, 1);
          return THREE.MathUtils.lerp(holdA(sta), holdB(sta), k);
        }
        const prev = stations[i - 1];
        return holdB(prev) + (holdA(sta) - holdB(prev)) * THREE.MathUtils.smoothstep(p, prev.p1, sta.p0);
      }
    }
    return 1;
  }
  function updateCamera(dt) {
    st.progress += (st.target - st.progress) * Math.min(1, dt * 12);
    const p = THREE.MathUtils.clamp(st.progress, 0, 1);
    const t = stationT(p);
    st.t = t;
    path.getPointAt(t, pos);
    path.getPointAt(Math.min(t + 0.03, 1), look);
    look.y = pos.y - 0.12;
    // Le dernier plan : pendant le trajet vers l'enseigne (t 0,835 à 0,97), le
    // regard glisse de l'allée vers l'enseigne, la caméra monte, le champ se
    // resserre comme un travelling avant.
    const endK = THREE.MathUtils.smoothstep(t, 0.835, 0.97);
    st.endK = endK;
    const lx = lookAtT(t) * (1 - endK);
    look.x += lx;
    pos.x -= lx * 0.22;
    look.lerp(signLook, endK);
    // La couleur d'ambiance glisse d'une section à l'autre, et le brouillard
    // s'éclaircit à l'approche de l'enseigne.
    const warm = 0x3a2830, cool = 0x26283a, wine = 0x4a1424;
    if (t < 0.4) hemi.color.setHex(warm).lerp(color.setHex(cool), THREE.MathUtils.smoothstep(t, 0.15, 0.4));
    else if (t < 0.75) hemi.color.setHex(cool).lerp(color.setHex(wine), THREE.MathUtils.smoothstep(t, 0.5, 0.75));
    else hemi.color.setHex(wine).lerp(color.setHex(warm), THREE.MathUtils.smoothstep(t, 0.8, 1));
    scene.fog.density = fogBase * (1 - 0.3 * endK);
    if (reflector) reflector.material.uniforms.uFogDensity.value = scene.fog.density;
    coneMat.uniforms.uFogDensity.value = scene.fog.density;
    // L'enseigne s'allume en arrivant, avec un grésillement de néon.
    const ignite = THREE.MathUtils.smoothstep(t, 0.86, 0.94);
    const flick = ignite > 0 && ignite < 0.999 ? (Math.sin(st.time * 41) * Math.sin(st.time * 13) > -0.15 ? 1 : 0.3) : 1;
    sign.material.opacity = ignite * flick;
    signGlow.intensity = 90 * ignite * flick;
    pos.z += st.intro * 30;
    pos.y += Math.sin(st.time * 0.9) * 0.02;
    pos.x += Math.sin(st.time * 0.55) * 0.035;
    st.ps.lerp(st.pointer, Math.min(1, dt * 4.5));
    pos.x += st.ps.x * 0.3; pos.y += st.ps.y * 0.16;
    look.x += st.ps.x * 1.5; look.y += st.ps.y * 0.75;
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.rotateZ(lx * 0.004);
    // La vitesse de défilement ouvre le champ : on sent qu'on avance.
    st.velTarget *= Math.exp(-dt * 3);
    st.vel += (st.velTarget - st.vel) * Math.min(1, dt * 5);
    const fov = (camera.aspect < 0.85 ? 74 : 58) - 7 * st.endK + st.vel * 7;
    if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (lens) { lens.uniforms.get('uCursor').value.set(st.ps.x * 0.5 + 0.5, st.ps.y * 0.5 + 0.5); }
  }

  function updateCursor(dt) {
    if (st.cursorSeen) {
      ray.setFromCamera(st.pointer, camera);
      if (ray.ray.intersectPlane(floorPlane, hit) && hit.distanceTo(camera.position) < 60) st.cursorTarget.copy(hit);
    } else {
      st.cursorTarget.set(camera.position.x, 0, camera.position.z - 9);
    }
    st.cursor.lerp(st.cursorTarget, Math.min(1, dt * 6));
    cursorLight.position.set(st.cursor.x, 1.3, st.cursor.z);
    if (reflector) {
      reflector.material.uniforms.uCursor.value.copy(st.cursor);
      reflector.material.uniforms.uTime.value = st.time;
    }
  }

  const lampDist = lampPositions.map(() => 0);
  function updateLamps() {
    const cz = camera.position.z;
    for (let i = 0; i < lampPositions.length; i++) lampDist[i] = Math.abs(lampPositions[i].z - cz);
    const order = lampPositions.map((_, i) => i).sort((a, b) => lampDist[a] - lampDist[b]);
    for (let k = 0; k < lampLights.length; k++) {
      const p = lampPositions[order[k]];
      const l = lampLights[k];
      l.position.set(p.hx, LOT.lampHeight - 0.6, p.z);
      const fade = 1 - THREE.MathUtils.smoothstep(lampDist[order[k]], 26, 46);
      l.intensity = (lite ? 55 : 75) * fade;
    }
    // Un cône vu de trop près trahit sa géométrie : il s'efface à l'approche.
    const cc = cones.instanceColor.array;
    for (let i = 0; i < lampPositions.length; i++) {
      const k = THREE.MathUtils.smoothstep(lampDist[i], 5, 15);
      cc[i * 3] = k; cc[i * 3 + 1] = k; cc[i * 3 + 2] = k;
    }
    cones.instanceColor.needsUpdate = true;
  }

  function updateHeadlights() {
    if (!cars) return;
    const cz = camera.position.z;
    const base = cars.lampBase;
    const attr = cars.lamps.instanceColor;
    const arr = attr.array;
    for (let i = 0; i < cars.specs.length; i++) {
      const dz = cz - cars.specs[i].z;
      const k = Math.exp(-(dz * dz) / 22);
      const boost = 1 + k * 2.6 * (0.8 + 0.2 * Math.sin(st.time * 11 + i * 1.7));
      for (let j = 0; j < 4; j++) {
        const id = (i * 4 + j) * 3;
        arr[id] = base[id] * boost; arr[id + 1] = base[id + 1] * boost; arr[id + 2] = base[id + 2] * boost;
      }
    }
    attr.needsUpdate = true;
  }

  function updateMarks(dt) {
    const cz = camera.position.z;
    marks.forEach((m) => {
      const dz = m.userData.z - cz;
      const near = THREE.MathUtils.smoothstep(dz, -32, -16);        // apparaît en approchant
      const passed = THREE.MathUtils.smoothstep(dz, 5, 12);         // disparaît une fois dépassé
      const s = Math.max(0.0001, near * (1 - passed));
      m.scale.setScalar(s);
      m.position.y = m.userData.baseY + Math.sin(st.time * 1.3 + m.userData.i) * 0.14;
      m.lookAt(camera.position);
      m.rotation.z = Math.sin(st.time * 0.8 + m.userData.i) * 0.12;
    });
  }

  function update(dt) {
    st.time += dt;
    updateCamera(dt);
    updateCursor(dt);
    updateLamps();
    updateHeadlights();
    updateMarks(dt);
    particles.material.uniforms.uTime.value = st.time;
    if (flashes) flashes.material.uniforms.uTime.value = st.time;
    composer.render(dt);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dpr = degraded ? Math.min(1, pickDpr()) : pickDpr();
    if (lens) lens.uniforms.get('uAspect').value = w / h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (reflector) reflector.getRenderTarget().setSize(Math.round(w * dpr * 0.35), Math.round(h * dpr * 0.35));
    particles.material.uniforms.uPixelRatio.value = dpr;
    if (flashes) flashes.material.uniforms.uPixelRatio.value = dpr;
  }
  resize();

  function enter() {
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to(st, { intro: 0, duration: reduced ? 0.8 : 4.4, ease: 'power2.inOut' }, 0)
        .to(gate.rotation, { z: 1.32, duration: reduced ? 0.6 : 1.8, ease: 'power3.inOut' }, reduced ? 0 : 1.1);
    });
  }

  function degrade() {
    degraded = true;
    resize();
    if (lensPass) { composer.removePass(lensPass); lensPass = null; }
    if (smaaPass) { composer.removePass(smaaPass); smaaPass = null; }
    if (noise) noise.blendMode.opacity.value = 0;
    bloom.intensity = 0.8;
  }

  const ready = carsReady.then(() => renderer.compileAsync(scene, camera)).catch(() => {});
  if (import.meta.env.DEV) window.__cc = { scene, camera, renderer, composer, sky, cones, marks, particles, reflector, st, hemi, floor, sign, get cars() { return cars; }, lampLights, cursorLight, path };

  return {
    ready, update, resize, enter, degrade,
    setProgress: (p) => { st.target = p; },
    setPointer: (x, y) => { st.pointer.set(x, y); st.cursorSeen = true; },
    setVelocity: (v) => { st.velTarget = Math.min(Math.abs(v) / 40, 1); },
    setStations: (list) => { stations = list; },
    get dpr() { return dpr; },
    lite,
  };
}
