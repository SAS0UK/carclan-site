// Les voitures du rasso : de vrais modèles glTF (Kenney Car Kit et Quaternius
// Cars, tous deux CC0), fusionnés dans public/models/cars.glb par
// tools/build-cars.mjs. Chaque modèle est découpé en deux parties : la
// carrosserie, recolorée par voiture (instanceColor), et le reste (vitres,
// roues, phares) qui garde sa couleur d'origine. Un modèle = deux appels de
// rendu, quel que soit le nombre d'exemplaires garés.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CAR_TYPES = {
  'k-sedan': { cat: 'sedan', length: 4.5 },
  'k-sedan-sports': { cat: 'sports', length: 4.4 },
  'k-hatchback-sports': { cat: 'hatch', length: 4.1 },
  'k-suv': { cat: 'suv', length: 4.7 },
  'k-suv-luxury': { cat: 'suv', length: 4.9 },
  'k-van': { cat: 'van', length: 5.0 },
  'k-truck': { cat: 'pickup', length: 5.4 },
  'k-truck-flat': { cat: 'pickup', length: 5.4 },
  'k-delivery': { cat: 'van', length: 5.3 },
  'k-race': { cat: 'race', length: 4.6 },
  'k-race-future': { cat: 'race', length: 4.7 },
  'q-sports-a': { cat: 'sports', length: 4.5 },
  'q-sports-b': { cat: 'sports', length: 4.4 },
  'q-car-a': { cat: 'sedan', length: 4.6 },
  'q-car-b': { cat: 'hatch', length: 3.9 },
  'q-suv': { cat: 'suv', length: 4.8 },
  'r-formula': { cat: 'formula', length: 4.6 },
};

// Matériaux Quaternius qui ne sont pas de la peinture.
const QUAT_PARTS = new Set(['Windows', 'Black', 'Grey', 'Headlights', 'TailLights', 'WhiteLights', 'BlueLights', 'Material.007', 'carTire', 'glass', 'grey']);

// Palette de carrosseries par catégorie : [hex, poids].
const PAINTS = {
  sports: [[0x8e1d2d, 3], [0xc8102e, 2], [0xe36f1e, 1], [0xf2ece6, 2], [0x0e0e12, 3], [0x1c2a44, 1], [0xe6b8a2, 1], [0x2b2b31, 1], [0xf0c000, 1]],
  race: [[0xf2ece6, 3], [0xc8102e, 2], [0x1c2a44, 2], [0xe36f1e, 1], [0x0e0e12, 1], [0x2f8f5b, 1]],
  hatch: [[0x0e0e12, 3], [0x2b2b31, 2], [0x8e1d2d, 2], [0xf2ece6, 2], [0x1c2a44, 1], [0x5a0d1e, 1], [0xe6b8a2, 1], [0x3a6ea5, 1]],
  sedan: [[0x0e0e12, 4], [0x2b2b31, 3], [0xc9c9cc, 2], [0xf2ece6, 2], [0x1c2a44, 2], [0x5a0d1e, 2], [0x233b2a, 1], [0x4a2c1c, 1]],
  suv: [[0x0e0e12, 4], [0x2b2b31, 2], [0xf2ece6, 2], [0x1c2a44, 2], [0x233b2a, 1], [0x5a0d1e, 1], [0x6b6b70, 1]],
  van: [[0xf2ece6, 3], [0x2b2b31, 2], [0x0e0e12, 2], [0x1c2a44, 1], [0x8e1d2d, 1]],
  pickup: [[0x0e0e12, 3], [0x2b2b31, 2], [0xf2ece6, 2], [0x4a2c1c, 1], [0x8e1d2d, 1], [0x233b2a, 1]],
  formula: [[0xc8102e, 3], [0xf2ece6, 2], [0xe36f1e, 2], [0x1c2a44, 2], [0x2fbf8f, 1], [0xf0c000, 1]],
};

// Répartition des catégories le long de l'allée : chaque zone raconte un type
// de rasso. Les zones suivent les sections de la page.
const ZONES = [
  { until: -38, weights: { sports: 3, sedan: 3, hatch: 2, suv: 2, race: 1, van: 1, pickup: 1 } },
  { until: -68, weights: { sports: 5, race: 2, hatch: 2, sedan: 1, formula: 1 } },
  { until: -98, weights: { hatch: 4, sports: 3, sedan: 2, race: 1 } },
  { until: -128, weights: { suv: 4, van: 2, pickup: 2, sedan: 2, sports: 1 } },
  { until: -999, weights: { race: 3, formula: 3, sports: 3, sedan: 1, hatch: 1 } },
];

function pickWeighted(entries, rand) {
  if (!entries.length) throw new Error('aucune catégorie disponible');
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) { r -= w; if (r <= 0) return v; }
  return entries[0][0];
}

function toFloat(attr, itemSize) {
  const out = new Float32Array(attr.count * itemSize);
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < itemSize; k++) out[i * itemSize + k] = attr.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, itemSize);
}

// Une géométrie propre : flottants, indexée, position/normal/uv/color.
function normalizeGeometry(src, matrixWorld, colorRGB) {
  const g = new THREE.BufferGeometry();
  const pos = toFloat(src.attributes.position, 3);
  pos.applyMatrix4(matrixWorld);
  g.setAttribute('position', pos);
  if (src.attributes.normal) {
    const n = toFloat(src.attributes.normal, 3);
    n.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrixWorld));
    g.setAttribute('normal', n);
  }
  g.setAttribute('uv', src.attributes.uv ? toFloat(src.attributes.uv, 2) : new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2));
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { col[i * 3] = colorRGB[0]; col[i * 3 + 1] = colorRGB[1]; col[i * 3 + 2] = colorRGB[2]; }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(src.index ? Array.from(src.index.array) : Array.from({ length: pos.count }, (_, i) => i));
  if (!src.attributes.normal) g.computeVertexNormals();
  return g;
}

function readPalette(texture) {
  texture.updateMatrix();
  const img = texture.image;
  const w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h, matrix: texture.matrix.clone() };
}

// Kenney : une seule texture palette. On échantillonne la couleur de chaque
// triangle, on regroupe les nuances proches, et la famille la plus étendue
// (claire ou saturée) est la carrosserie. Les gris bleutés sombres sont les
// vitres.
function classifyPalette(g, palette) {
  const idx = g.index.array, uv = g.attributes.uv, pos = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const tuv = new THREE.Vector2();
  const triKey = new Int32Array(idx.length / 3);
  const colors = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
    tuv.set((uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3, (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3).applyMatrix3(palette.matrix);
    const u = tuv.x - Math.floor(tuv.x), v = tuv.y - Math.floor(tuv.y);
    const px = Math.min(palette.w - 1, Math.floor(u * palette.w));
    const py = Math.min(palette.h - 1, Math.floor(v * palette.h));
    const o = (py * palette.w + px) * 4;
    const key = (palette.data[o] << 16) | (palette.data[o + 1] << 8) | palette.data[o + 2];
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const area = b.sub(a).cross(c.sub(a)).length();
    triKey[t / 3] = key;
    const e = colors.get(key) || { key, rgb: [palette.data[o], palette.data[o + 1], palette.data[o + 2]], area: 0 };
    e.area += area; colors.set(key, e);
  }
  const entries = [...colors.values()].sort((x, y) => y.area - x.area);
  const clusters = [];
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  for (const e of entries) {
    let cl = clusters.find((k) => dist(k.rgb, e.rgb) < 44);
    if (!cl) { cl = { rgb: e.rgb.slice(), area: 0, keys: new Set() }; clusters.push(cl); }
    cl.area += e.area; cl.keys.add(e.key);
  }
  const stats = (cl) => {
    const [r, g2, b2] = cl.rgb.map((v) => v / 255);
    const mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2);
    return { r, g: g2, b: b2, lum: 0.3 * r + 0.59 * g2 + 0.11 * b2, sat: mx ? (mx - mn) / mx : 0 };
  };
  let paint = null, best = 0;
  for (const cl of clusters) {
    const st = stats(cl);
    if (st.lum > 0.5 || st.sat > 0.35) { const score = cl.area * (1 + st.sat); if (score > best) { best = score; paint = cl; } }
  }
  const glassKeys = new Set();
  for (const cl of clusters) {
    const st = stats(cl);
    if (cl !== paint && st.b > st.r + 0.04 && st.lum > 0.22 && st.lum < 0.58 && st.sat < 0.45) cl.keys.forEach((k) => glassKeys.add(k));
  }
  const paintKeys = paint ? paint.keys : new Set();
  const paintIdx = [], glassIdx = [], restIdx = [];
  for (let t = 0; t < idx.length; t += 3) {
    const k = triKey[t / 3];
    (paintKeys.has(k) ? paintIdx : glassKeys.has(k) ? glassIdx : restIdx).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const part = (list) => { if (!list.length) return null; const gg = g.clone(); gg.setIndex(list); return gg; };
  return {
    paint: part(paintIdx), glass: part(glassIdx), rest: part(restIdx),
    debug: { paint: paint ? paint.rgb : null, tris: idx.length / 3, paintTris: paintIdx.length / 3, glassTris: glassIdx.length / 3 },
  };
}

export async function loadCarTypes(url, onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url, (e) => onProgress && onProgress(e.total ? e.loaded / e.total : 0.5));
  let palette = null, paletteTexture = null;
  const types = [];
  for (const scene of gltf.scenes) {
    const def = CAR_TYPES[scene.name];
    if (!def) continue;
    scene.updateMatrixWorld(true);
    const kenney = scene.name.startsWith('k-');
    const paints = [], glasses = [], rests = [], all = [];
    let noseSign = 0, debug = null;
    scene.traverse((o) => {
      if (/wheel/i.test(o.name) && /front/i.test(o.name)) {
        const p = new THREE.Vector3(); o.getWorldPosition(p); noseSign += Math.sign(p.z);
      }
      if (!o.isMesh) return;
      const mat = o.material;
      if (kenney) {
        if (!palette && mat.map) { palette = readPalette(mat.map); paletteTexture = mat.map; }
        all.push(normalizeGeometry(o.geometry, o.matrixWorld, [1, 1, 1]));
      } else {
        const name = mat.name || '';
        const c = mat.color;
        if (/^windows?$|^glass$/i.test(name)) glasses.push(normalizeGeometry(o.geometry, o.matrixWorld, [1, 1, 1]));
        else if (QUAT_PARTS.has(name)) rests.push(normalizeGeometry(o.geometry, o.matrixWorld, [c.r, c.g, c.b]));
        else { const shade = /^dark/i.test(name) ? 0.55 : 1; paints.push(normalizeGeometry(o.geometry, o.matrixWorld, [shade, shade, shade])); }
      }
    });
    if (kenney && all.length && palette) {
      const merged = mergeGeometries(all, false);
      const parts = classifyPalette(merged, palette);
      debug = parts.debug;
      if (parts.paint) paints.push(parts.paint);
      if (parts.glass) glasses.push(parts.glass);
      if (parts.rest) rests.push(parts.rest);
    }
    if (!paints.length) continue;
    const paint = mergeGeometries(paints, false);
    const glass = glasses.length ? mergeGeometries(glasses, false) : null;
    const rest = rests.length ? mergeGeometries(rests, false) : null;
    const geos = [paint, glass, rest].filter(Boolean);
    // Orientation : le nez vers +X. Les trois kits ont la longueur sur Z.
    const nose = noseSign >= 0 ? 1 : -1;
    const m = new THREE.Matrix4().makeRotationY(nose > 0 ? Math.PI / 2 : -Math.PI / 2);
    geos.forEach((g) => g.applyMatrix4(m));
    const box = new THREE.Box3();
    geos.forEach((g) => { g.computeBoundingBox(); box.union(g.boundingBox); });
    const size = new THREE.Vector3(); box.getSize(size);
    const s = def.length / size.x;
    // Les kits stylisés sont trapus : on resserre largeur et hauteur.
    const prop = kenney ? { w: 0.76, h: 0.72 } : scene.name.startsWith('r-') ? { w: 0.88, h: 0.95 } : { w: 0.94, h: 1.0 };
    const center = new THREE.Vector3(); box.getCenter(center);
    const fix = new THREE.Matrix4().makeScale(s, s * prop.h, s * prop.w).multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
    const finalBox = new THREE.Box3();
    geos.forEach((g) => { g.applyMatrix4(fix); g.computeBoundingBox(); g.computeBoundingSphere(); finalBox.union(g.boundingBox); });
    const fs = new THREE.Vector3(); finalBox.getSize(fs);
    types.push({ key: scene.name, cat: def.cat, kenney, paint, glass, rest, size: fs, debug });
  }
  return { types, paletteTexture };
}

export function buildCars({ types, paletteTexture }, { aisleHalf, bayPitch, firstBayZ, lastBayZ, seed = 11, envMapIntensity = 1.2, lite = false }) {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const byCat = {};
  for (const t of types) (byCat[t.cat] = byCat[t.cat] || []).push(t);

  const specs = [];
  for (let z = firstBayZ; z >= lastBayZ; z -= bayPitch) {
    const zone = ZONES.find((zn) => z > zn.until) || ZONES[ZONES.length - 1];
    for (const side of [-1, 1]) {
      if (rand() < 0.07) continue;
      const entries = Object.entries(zone.weights).filter(([cat]) => byCat[cat]);
      const cat = pickWeighted(entries, rand);
      const list = byCat[cat];
      const type = list[Math.floor(rand() * list.length)];
      const reversed = rand() < 0.28;
      const x = side * (aisleHalf + 2.35 + (rand() - 0.5) * 0.4);
      const yaw = (side < 0 ? 0 : Math.PI) + (reversed ? Math.PI : 0) + (rand() - 0.5) * 0.07;
      const paint = pickWeighted(PAINTS[cat] || PAINTS.sedan, rand);
      const zoneIndex = ZONES.indexOf(zone);
      const glow = rand() < (zoneIndex === 1 || zoneIndex === 2 ? 0.34 : 0.06);
      specs.push({ type, x, z: z + (rand() - 0.5) * 0.3, yaw, reversed, paint, side, glow, zone: zoneIndex });
    }
  }

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity,
  });
  const restMapMat = new THREE.MeshStandardMaterial({ map: paletteTexture || null, vertexColors: true, roughness: 0.5, metalness: 0.25, envMapIntensity: envMapIntensity * 0.75 });
  const restVertexMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.32, envMapIntensity: envMapIntensity * 0.85 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x090a12, metalness: 0.9, roughness: 0.1, envMapIntensity: envMapIntensity * 1.5 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const carMatrix = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const color = new THREE.Color();

  const meshes = new Map();
  for (const t of types) {
    const count = specs.filter((c) => c.type === t).length;
    if (!count) continue;
    const paint = new THREE.InstancedMesh(t.paint, paintMat, count);
    paint.name = `paint-${t.key}`;
    const rest = t.rest ? new THREE.InstancedMesh(t.rest, t.kenney ? restMapMat : restVertexMat, count) : null;
    if (rest) rest.name = `rest-${t.key}`;
    const glass = t.glass ? new THREE.InstancedMesh(t.glass, glassMat, count) : null;
    if (glass) glass.name = `glass-${t.key}`;
    meshes.set(t, { paint, rest, glass, i: 0 });
    group.add(paint); if (rest) group.add(rest); if (glass) group.add(glass);
  }

  const lampGeo = new THREE.BoxGeometry(0.06, 0.12, 0.34);
  const lamps = new THREE.InstancedMesh(lampGeo, lightMat, specs.length * 4);
  lamps.name = 'lamps';
  const lampBase = new Float32Array(specs.length * 4 * 3);

  const glowSpecs = specs.filter((c) => c.glow);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: lite ? 0.5 : 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    Math.max(glowSpecs.length, 1),
  );
  glows.count = glowSpecs.length;
  glows.name = 'underglow';
  const GLOW_COLORS = [0xe6b8a2, 0x8e1d2d, 0x3a6ea5, 0x7a3fd6, 0x2fbf8f, 0xff3b6b];

  specs.forEach((c, i) => {
    const t = c.type;
    dummy.position.set(c.x, 0, c.z);
    dummy.rotation.set(0, c.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    carMatrix.copy(dummy.matrix);
    const m = meshes.get(t);
    const k = m.i++;
    m.paint.setMatrixAt(k, carMatrix);
    m.paint.setColorAt(k, color.setHex(c.paint));
    if (m.rest) m.rest.setMatrixAt(k, carMatrix);
    if (m.glass) m.glass.setMatrixAt(k, carMatrix);

    const L = t.size.x, W = t.size.z, H = t.size.y;
    const ly = Math.min(H * 0.42, 0.95);
    [[L / 2 + 0.02, ly, W * 0.33, 1], [L / 2 + 0.02, ly, -W * 0.33, 1], [-L / 2 - 0.02, ly + 0.04, W * 0.34, 0], [-L / 2 - 0.02, ly + 0.04, -W * 0.34, 0]].forEach(([lx, lyy, lz, front], j) => {
      local.identity().setPosition(lx, lyy, lz);
      const id = i * 4 + j;
      lamps.setMatrixAt(id, carMatrix.clone().multiply(local));
      const rgb = front ? [2.6, 2.25, 1.75] : [2.4, 0.16, 0.12];
      lampBase.set(rgb, id * 3);
      lamps.setColorAt(id, color.setRGB(rgb[0], rgb[1], rgb[2]));
    });
  });

  glowSpecs.forEach((c, gi) => {
    const t = c.type;
    dummy.position.set(c.x, 0.03, c.z);
    dummy.rotation.set(-Math.PI / 2, 0, c.yaw);
    dummy.scale.set(t.size.x * 1.25, t.size.z * 1.9, 1);
    dummy.updateMatrix();
    glows.setMatrixAt(gi, dummy.matrix);
    glows.setColorAt(gi, color.setHex(GLOW_COLORS[Math.floor(rand() * GLOW_COLORS.length)]));
  });

  for (const { paint, rest, glass } of meshes.values()) {
    paint.instanceMatrix.needsUpdate = true;
    if (paint.instanceColor) paint.instanceColor.needsUpdate = true;
    if (rest) rest.instanceMatrix.needsUpdate = true;
    if (glass) glass.instanceMatrix.needsUpdate = true;
  }
  lamps.instanceMatrix.needsUpdate = true;
  lamps.instanceColor.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
  if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
  group.add(lamps, glows);

  return { group, specs, lamps, lampBase, materials: { paintMat, restMapMat, restVertexMat, glassMat } };
}

// Des flashs d'appareils photo devant les voitures des zones « expo » :
// quelques points qui claquent au hasard, le bloom fait le reste.
export function buildFlashes(specs, { aisleHalf, count = 18 }) {
  const candidates = specs.filter((c) => c.zone === 1 || c.zone === 2 || c.zone === 4);
  const n = Math.min(count, candidates.length);
  const pos = new Float32Array(n * 3), phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = candidates[Math.floor((i / n) * candidates.length)];
    pos[i * 3] = c.side * (aisleHalf - 1.1 - Math.random() * 1.2);
    pos[i * 3 + 1] = 1.45 + Math.random() * 0.5;
    pos[i * 3 + 2] = c.z + (Math.random() - 0.5) * 2.4;
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aPhase; uniform float uTime; uniform float uPixelRatio;
      varying float vI;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float cycle = fract(uTime * 0.085 + aPhase);
        vI = exp(-cycle * 55.0);
        float dist = max(-mv.z, 0.5);
        gl_PointSize = (vI > 0.02 ? 1.0 : 0.0) * 90.0 * uPixelRatio * (16.0 / dist);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vI;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vI;
        gl_FragColor = vec4(vec3(3.0, 2.9, 2.7) * a, a);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'flashes';
  return points;
}
