// La scène du site : un parking la nuit, sous des lampadaires au sodium.
//
// Sodium, la direction artistique de CarClan, porte le nom de cette lumière :
// l'ambre de la marque (#e2a21f) est celui d'un lampadaire de parking. La
// scène le prend au mot. Aucun modèle de voiture : les kits low-poly ont été
// retirés le 21 septembre 2026, et aucune vraie voiture n'existe en licence
// commerciale sûre. Ce qui rend l'image, c'est la lumière, pas les objets :
//
// - un sol de bitume mouillé qui reflète vraiment ce qu'il y a au-dessus
//   (Reflector), avec des flaques, des rides et un grain de goudron ;
// - des cônes de lumière volumétriques sous chaque lampe, traversés de
//   volutes qui descendent ;
// - de la poussière en suspension dans les faisceaux ;
// - une brume exponentielle couleur nuit, qui avale le fond ;
// - un tone mapping ACES et un bloom en HDR, une profondeur de champ
//   légère, une vignette et un grain fin.
//
// Trois régimes : plein (ordinateur), `lite` (téléphone ou machine faible :
// pas de reflet, pas de profondeur de champ, moins de poussière) et
// `reduced` (prefers-reduced-motion : une seule image, rien ne bouge).
// La scène ne bloque jamais la page : elle se charge après le contenu et
// apparaît en fondu quand sa première image est prête.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, DepthOfFieldEffect, VignetteEffect, NoiseEffect,
  ToneMappingEffect, ToneMappingMode, BlendFunction,
} from 'postprocessing';

const NUIT = 0x0f0e0c;
const AMBRE = 0xe2a21f;
// La lampe elle-même : plus claire que l'encre ambre, c'est une source.
const SODIUM = 0xffc25a;

// Les lampadaires : deux rangées qui s'enfoncent dans la brume.
const LAMP_X = 3.4;
const LAMP_H = 4.4;
const LAMP_STEP = 7.5;
const LAMP_ROWS = 7;
const LAMP_COUNT = LAMP_ROWS * 2;

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
`;

// Le sol. Un seul shader pour les deux régimes : avec REFLECT, il projette la
// texture rendue par le Reflector ; sans, il ne garde que le bitume et les
// flaques de lumière. Les lampes n'éclairent pas ce matériau par le moteur
// (un ShaderMaterial n'est pas éclairé) : leurs flaques sont calculées ici,
// ce qui les rend identiques dans les deux régimes et beaucoup moins chères.
function groundShader({ reflect }) {
  return {
    name: 'BitumeMouille',
    defines: reflect ? { REFLECT: '' } : {},
    uniforms: {
      color: { value: new THREE.Color(NUIT) },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uLampColor: { value: new THREE.Color(AMBRE) },
      uLamps: { value: Array.from({ length: LAMP_COUNT }, () => new THREE.Vector4()) },
      uFog: { value: 0.03 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUvP;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vUvP = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec3 uLampColor;
      uniform vec4 uLamps[${LAMP_COUNT}];
      uniform float uFog;
      varying vec4 vUvP;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        vec2 w = vWorld.xz;
        // Les flaques : de grandes nappes, et un bord net.
        float wet = smoothstep(0.42, 0.66, fbm(w * 0.09 + 5.3));
        // Le grain du goudron, deux échelles.
        float grain = vnoise(w * 38.0) * 0.6 + vnoise(w * 97.0) * 0.4;
        vec3 asphalt = color * (0.75 + 1.1 * grain) * mix(1.0, 0.48, wet);

        // Les flaques de lumière sous chaque lampe.
        vec3 pool = vec3(0.0);
        for (int i = 0; i < ${LAMP_COUNT}; i++) {
          vec4 L = uLamps[i];
          float d = distance(w, L.xy) / L.z;
          pool += uLampColor * L.w * pow(clamp(1.0 - d, 0.0, 1.0), 2.4) * (0.85 + 0.3 * grain);
        }

        vec3 col = asphalt + pool * mix(0.5, 0.9, wet);

        #ifdef REFLECT
          // Rides à la surface, puis cinq prélèvements pour adoucir : un
          // reflet sur du bitume mouillé n'est jamais net.
          vec2 ripple = (vec2(vnoise(w * 1.7 + uTime * 0.11), vnoise(w * 1.9 - uTime * 0.09)) - 0.5) * 0.02 * mix(1.0, 0.35, wet);
          vec4 uv = vUvP;
          uv.xy += ripple * uv.w;
          float px = 0.0025 * uv.w;
          vec3 refl = texture2DProj(tDiffuse, uv).rgb * 0.4
            + texture2DProj(tDiffuse, uv + vec4(px, 0.0, 0.0, 0.0)).rgb * 0.15
            + texture2DProj(tDiffuse, uv - vec4(px, 0.0, 0.0, 0.0)).rgb * 0.15
            + texture2DProj(tDiffuse, uv + vec4(0.0, px, 0.0, 0.0)).rgb * 0.15
            + texture2DProj(tDiffuse, uv - vec4(0.0, px, 0.0, 0.0)).rgb * 0.15;
          // Fresnel : plus la vue est rasante, plus l'eau reflète.
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(V.y, 0.0), 2.5);
          float k = mix(0.06, 0.75, wet) * mix(0.35, 1.0, fres);
          col += refl * k;
        #endif

        float dist = distance(cameraPosition, vWorld);
        float fog = 1.0 - exp(-uFog * uFog * dist * dist);
        col = mix(col, color, fog);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  };
}

// Le cône de lumière sous une lampe : un cylindre ouvert, additif, dont
// l'intensité tombe vers le bas et vers les bords, traversé de volutes.
function coneMaterial(seed) {
  return new THREE.ShaderMaterial({
    name: 'ConeDeLumiere',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(AMBRE) },
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uSeed: { value: seed },
      uFog: { value: 0.03 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uSeed;
      uniform float uFog;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        float t = vUv.y; // 1 en haut, sous la lampe
        float vert = pow(t, 1.6);
        vec3 V = normalize(cameraPosition - vWorld);
        float edge = smoothstep(0.0, 0.85, abs(dot(normalize(vN), V)));
        float n = vnoise(vec2(vUv.x * 5.0 + uSeed, t * 2.6 - uTime * 0.22)) * 0.5 + 0.5;
        float dist = distance(cameraPosition, vWorld);
        float fog = exp(-uFog * uFog * dist * dist);
        float a = vert * edge * (0.55 + 0.45 * n) * uIntensity * fog * 0.55;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

// La poussière : des points qui tombent lentement dans les faisceaux, plus
// gros et plus clairs près de la caméra, éteints par la brume au loin.
function dustMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    name: 'Poussiere',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(SODIUM) },
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uFog: { value: 0.03 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uFog;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * (0.05 + 0.05 * aSeed), ${LAMP_H.toFixed(1)});
        p.x += sin(uTime * 0.25 + aSeed * 6.2831) * 0.12;
        p.z += cos(uTime * 0.21 + aSeed * 6.2831) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        gl_PointSize = (0.7 + aSeed * 0.8) * uPixelRatio * clamp(60.0 / d, 0.3, 4.0);
        // La poussière n'est visible que dans la lumière : forte sous la
        // lampe (p.y haut), faible au sol.
        vA = exp(-uFog * uFog * d * d) * mix(0.25, 1.0, p.y / ${LAMP_H.toFixed(1)});
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r) * vA * 0.12;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Le halo d'une lampe vue de face : un disque doux, additif, toujours face
// à la caméra. C'est lui que le bloom attrape.
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createScene(canvas, { lite = false, reduced = false, touch = false } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  // Le tone mapping est fait en fin de chaîne par le composer, en HDR ;
  // le moteur, lui, rend en linéaire.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(NUIT, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NUIT);
  const fogDensity = lite ? 0.034 : 0.03;
  scene.fog = new THREE.FogExp2(NUIT, fogDensity);

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 140);
  camera.position.set(0.7, 1.55, 4);
  const look = new THREE.Vector3(0, 1.3, -14);

  // Une lueur d'ambiance très faible : elle dessine les mâts en silhouette.
  scene.add(new THREE.HemisphereLight(0x2a1f0c, 0x000000, 0.9));

  // ---- Les lampes ---------------------------------------------------------
  const lampPositions = [];
  for (let i = 0; i < LAMP_ROWS; i++) {
    const z = -2 - i * LAMP_STEP;
    lampPositions.push(new THREE.Vector3(-LAMP_X, LAMP_H, z), new THREE.Vector3(LAMP_X, LAMP_H, z));
  }
  const headX = (p) => p.x + (p.x < 0 ? 1 : -1) * 0.85;

  const mastGeo = new THREE.CylinderGeometry(0.045, 0.075, LAMP_H, 10);
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.75, metalness: 0.5 });
  const armGeo = new THREE.BoxGeometry(0.9, 0.06, 0.06);
  const headGeo = new THREE.BoxGeometry(0.62, 0.12, 0.3);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.6, metalness: 0.6 });
  const bulbGeo = new THREE.PlaneGeometry(0.46, 0.16);
  const bulbMat = new THREE.MeshBasicMaterial({ color: SODIUM, toneMapped: false });
  // Les lampes sont des sources : elles doivent dépasser le blanc pour que
  // le bloom les attrape et que le tone mapping ne les éteigne pas.
  const coneGeo = new THREE.CylinderGeometry(0.22, 2.35, LAMP_H - 0.2, 40, 1, true);
  const glowMap = glowTexture();
  const cones = [];

  lampPositions.forEach((p, i) => {
    const side = p.x < 0 ? 1 : -1; // la tête se penche vers la voie
    const hx = headX(p);

    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(p.x, LAMP_H / 2, p.z);
    scene.add(mast);

    const arm = new THREE.Mesh(armGeo, mastMat);
    arm.position.set(p.x + side * 0.42, LAMP_H - 0.06, p.z);
    scene.add(arm);

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(hx, LAMP_H - 0.1, p.z);
    scene.add(head);

    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.rotation.x = -Math.PI / 2;
    bulb.position.set(hx, LAMP_H - 0.165, p.z);
    scene.add(bulb);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: SODIUM, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
    glow.scale.set(1.5, 1.5, 1);
    glow.position.set(hx, LAMP_H - 0.2, p.z);
    scene.add(glow);

    const cone = new THREE.Mesh(coneGeo, coneMaterial(i * 1.37));
    cone.position.set(hx, (LAMP_H - 0.2) / 2, p.z);
    cones.push(cone);
    scene.add(cone);

    // Les vraies lumières ne servent qu'aux mâts et aux têtes : les six
    // premières suffisent, les flaques au sol sont dans le shader.
    if (i < 6) {
      const light = new THREE.PointLight(AMBRE, 42, 18, 2);
      light.position.set(hx, LAMP_H - 0.3, p.z);
      scene.add(light);
    }
  });

  // ---- Le sol ---------------------------------------------------------------
  const groundGeo = new THREE.PlaneGeometry(160, 160);
  const reflSize = () => [
    Math.round(window.innerWidth * Math.min(dpr, 1.5) * 0.5),
    Math.round(window.innerHeight * Math.min(dpr, 1.5) * 0.5),
  ];
  let ground;
  let groundUniforms;
  if (lite) {
    const mat = new THREE.ShaderMaterial(groundShader({ reflect: false }));
    ground = new THREE.Mesh(groundGeo, mat);
    groundUniforms = mat.uniforms;
  } else {
    const [rw, rh] = reflSize();
    ground = new Reflector(groundGeo, { clipBias: 0.004, textureWidth: rw, textureHeight: rh, color: NUIT, shader: groundShader({ reflect: true }) });
    groundUniforms = ground.material.uniforms;
  }
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  lampPositions.forEach((p, i) => groundUniforms.uLamps.value[i].set(headX(p), p.z, 5.2, 0.62));
  groundUniforms.uFog.value = fogDensity;

  // ---- La poussière ----------------------------------------------------------
  const dustCount = lite ? 500 : 1600;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const L = lampPositions[i % lampPositions.length];
    const hx = headX(L);
    const y = Math.random() * LAMP_H;
    const r = (0.1 + (1 - y / LAMP_H) * 1.5) * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    dustPos[i * 3] = hx + Math.cos(a) * r;
    dustPos[i * 3 + 1] = y;
    dustPos[i * 3 + 2] = L.z + Math.sin(a) * r;
    dustSeed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dust = new THREE.Points(dustGeo, dustMaterial(dpr));
  dust.frustumCulled = false;
  scene.add(dust);
  dust.material.uniforms.uFog.value = fogDensity;
  cones.forEach((c) => { c.material.uniforms.uFog.value = fogDensity; });

  // ---- La chaîne d'effets ------------------------------------------------------
  // ⚠️ Pas de multisampling sur ce composer : combiné au tampon demi-flottant
  // qu'exige le HDR, il rend une image entièrement noire sur les pilotes qui
  // ne savent pas résoudre un tampon multi-échantillons de ce format (vérifié
  // le 21 septembre 2026, Chrome headless). L'aliasing est de toute façon peu
  // visible ici : la brume, le bloom et le grain adoucissent déjà les arêtes,
  // et la seule ligne franche de la scène est le mât d'un lampadaire.
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({ intensity: lite ? 0.85 : 1.0, luminanceThreshold: 0.42, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.66, levels: lite ? 5 : 7 });
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
  const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
  noise.blendMode.opacity.value = 0.055;
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  let dof = null;
  const effects = [bloom];
  if (!lite) {
    dof = new DepthOfFieldEffect(camera, { focusDistance: 0.0, focalLength: 0.05, bokehScale: 1.1 });
    dof.target = new THREE.Vector3(0, 1, -8);
    effects.push(dof);
  }
  effects.push(vignette, noise, tone);
  composer.addPass(new EffectPass(camera, ...effects));

  // ---- Le mouvement --------------------------------------------------------------
  const pointer = new THREE.Vector2(0, 0);
  const pointerEased = new THREE.Vector2(0, 0);
  let progress = 0;
  let progressEased = 0;
  let time = 0;
  let running = false;
  let raf = 0;
  let ready = false;
  // Le pas de temps est mesuré ici plutôt qu'avec THREE.Clock, déprécié
  // depuis r180 et absent de remplaçant dans cette version. Le delta est
  // borné : au retour d'un onglet resté caché, un pas énorme ferait sauter
  // la caméra et la poussière.
  let dernier = 0;

  function place() {
    const p = progressEased;
    // La caméra avance dans l'allée pendant que la page défile, se relève
    // un peu, et regarde plus loin vers la brume à la fin.
    camera.position.x = 0.7 + pointerEased.x * 0.55 - p * 0.4;
    camera.position.y = 1.55 + pointerEased.y * 0.18 + p * 0.85;
    camera.position.z = 4 - p * 26;
    look.set(0.1 - pointerEased.x * 0.6, 1.3 + p * 1.4 + pointerEased.y * 0.35, camera.position.z - 16);
    camera.lookAt(look);
    if (dof) dof.target.set(0, 1.2, camera.position.z - 9);
  }

  function frame() {
    const maintenant = performance.now() / 1000;
    const dt = dernier ? Math.min(maintenant - dernier, 0.05) : 0.016;
    dernier = maintenant;
    time += dt;
    const k = 1 - Math.pow(0.001, dt); // lissage indépendant de la cadence
    pointerEased.lerp(pointer, k * 0.6);
    progressEased += (progress - progressEased) * k * 0.9;
    place();
    groundUniforms.uTime.value = time;
    dust.material.uniforms.uTime.value = time;
    for (let i = 0; i < cones.length; i++) {
      const m = cones[i].material.uniforms;
      m.uTime.value = time;
      // Un scintillement à peine perceptible, propre à chaque lampe.
      m.uIntensity.value = 0.94 + 0.06 * Math.sin(time * (1.7 + i * 0.13) + i);
    }
    composer.render(dt);
    if (!ready) { ready = true; canvas.classList.add('on'); }
  }

  function loop() {
    if (!running) return;
    frame();
    raf = requestAnimationFrame(loop);
  }

  // `compileAsync` prépare les programmes GPU sans bloquer : sans lui, la
  // première image compile une douzaine de shaders d'un coup et gèle la
  // page une demi-seconde.
  const pret = renderer.compileAsync
    ? renderer.compileAsync(scene, camera).catch(() => {})
    : Promise.resolve();

  function start() {
    if (reduced) { pret.then(() => { progressEased = progress; pointerEased.set(0, 0); frame(); }); return; }
    if (running) return;
    running = true;
    dernier = 0;
    pret.then(() => { if (running) raf = requestAnimationFrame(loop); });
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (ground.getRenderTarget) ground.getRenderTarget().setSize(...reflSize());
    if (reduced) frame();
  }

  // Sur ordinateur, la caméra suit un peu le curseur. Au doigt, rien : un
  // téléphone qui bouge la caméra à chaque tap est pénible.
  if (!touch && !reduced) {
    window.addEventListener('pointermove', (e) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    }, { passive: true });
  }

  // La scène ne tourne pas quand l'onglet est caché.
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  return {
    lite,
    start,
    stop,
    resize,
    setProgress(p) { progress = Math.max(0, Math.min(1, p)); if (reduced) { progressEased = progress; frame(); } },
    // Si la cadence ne tient pas, on baisse la définition et on retire la
    // profondeur de champ, sans recréer la scène.
    degrade() {
      renderer.setPixelRatio(1);
      composer.setSize(window.innerWidth, window.innerHeight);
      if (dof) {
        composer.removeAllPasses();
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new EffectPass(camera, bloom, vignette, noise, tone));
        dof = null;
      }
    },
  };
}
