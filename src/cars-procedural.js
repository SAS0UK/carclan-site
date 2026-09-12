// Voitures procédurales : un profil 2D extrudé, des passages de roue découpés
// dans le profil, une cabine vitrée posée dessus, quatre roues, quatre feux.
// Aucun modèle téléchargé : de nuit, la silhouette et les reflets font le
// travail, et tout le parking pèse quelques kilo-octets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const VARIANTS = {
  coupe: {
    width: 1.82, wheelR: 0.33, wheelX: 1.42, wheelZ: 0.78, lightY: 0.62,
    body: [[-2.2, 0.32], [-2.26, 0.62], [-2.08, 0.8], [-1.3, 0.86], [1.3, 0.9], [2.12, 0.8], [2.26, 0.56], [2.2, 0.32]],
    glass: [[-1.28, 0.86], [-0.9, 1.27], [0.05, 1.36], [0.85, 1.31], [1.28, 0.9]],
  },
  berline: {
    width: 1.84, wheelR: 0.33, wheelX: 1.52, wheelZ: 0.8, lightY: 0.66,
    body: [[-2.35, 0.32], [-2.4, 0.66], [-2.15, 0.88], [-1.4, 0.92], [1.45, 0.94], [2.28, 0.82], [2.4, 0.56], [2.35, 0.32]],
    glass: [[-1.38, 0.92], [-0.9, 1.34], [0.25, 1.4], [1.0, 1.36], [1.43, 0.94]],
  },
  suv: {
    width: 1.9, wheelR: 0.38, wheelX: 1.45, wheelZ: 0.82, lightY: 0.82,
    body: [[-2.3, 0.42], [-2.36, 0.8], [-2.2, 1.06], [-1.75, 1.1], [1.55, 1.12], [2.3, 1.0], [2.4, 0.66], [2.3, 0.42]],
    glass: [[-1.73, 1.1], [-1.55, 1.62], [-1.2, 1.74], [1.0, 1.72], [1.4, 1.5], [1.53, 1.12]],
  },
};

// Palette de carrosseries : sombre et riche, deux teintes de la marque, une
// note claire de temps en temps pour que la lumière accroche.
const PAINTS = [
  [0x0e0e12, 5], [0x2b2b31, 3], [0x5a0d1e, 3], [0x8e1d2d, 1], [0x1c2a44, 2],
  [0x233b2a, 1], [0x3a3a3f, 2], [0xc9c9cc, 2], [0xf2ece6, 2], [0x4a2c1c, 1], [0xe6b8a2, 1],
];

function pickPaint(rand) {
  const total = PAINTS.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [hex, w] of PAINTS) { r -= w; if (r <= 0) return hex; }
  return PAINTS[0][0];
}

function bodyShape(v) {
  const s = new THREE.Shape();
  const pts = v.body;
  const bottom = pts[0][1];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  // Retour le long du bas, de l'avant vers l'arrière, avec les deux arches.
  const r = v.wheelR + 0.1;
  const cy = v.wheelR;
  const dy = bottom - cy;
  const dx = Math.sqrt(Math.max(r * r - dy * dy, 0.0001));
  const a0 = Math.atan2(dy, dx);
  const a1 = Math.PI - a0;
  s.lineTo(v.wheelX + dx, bottom);
  s.absarc(v.wheelX, cy, r, a0, a1, false);
  s.lineTo(-v.wheelX + dx, bottom);
  s.absarc(-v.wheelX, cy, r, a0, a1, false);
  s.lineTo(pts[0][0], pts[0][1]);
  s.closePath();
  return s;
}

function glassShape(v) {
  const s = new THREE.Shape();
  const pts = v.glass;
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

function extrudeCentered(shape, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10,
  });
  g.translate(0, 0, -width / 2);
  g.computeBoundingBox();
  return g;
}

export function buildProceduralCars({ aisleHalf, bayPitch, firstBayZ, lastBayZ, seed = 7, envMapIntensity = 1.2 }) {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };

  const names = Object.keys(VARIANTS);
  const bodyGeos = {}, glassGeos = {};
  for (const n of names) {
    const v = VARIANTS[n];
    bodyGeos[n] = extrudeCentered(bodyShape(v), v.width, 0.05);
    glassGeos[n] = extrudeCentered(glassShape(v), v.width - 0.1, 0.02);
  }

  // Placement : une voiture par place, nez vers l'allée, quelques-unes en
  // marche arrière (feux rouges côté allée), quelques places vides.
  const specs = [];
  for (let z = firstBayZ; z >= lastBayZ; z -= bayPitch) {
    for (const side of [-1, 1]) {
      if (rand() < 0.08) continue;
      const variant = names[Math.floor(rand() * names.length)];
      const reversed = rand() < 0.3;
      const x = side * (aisleHalf + 2.3 + (rand() - 0.5) * 0.4);
      const yaw = (side < 0 ? 0 : Math.PI) + (reversed ? Math.PI : 0) + (rand() - 0.5) * 0.08;
      specs.push({ variant, x, z: z + (rand() - 0.5) * 0.3, yaw, reversed, paint: pickPaint(rand), side });
    }
  }

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x07070b, metalness: 0.95, roughness: 0.06, envMapIntensity: envMapIntensity * 1.4,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.9, metalness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9b9bd, roughness: 0.28, metalness: 0.9, envMapIntensity });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const carMatrix = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const color = new THREE.Color();

  const bodies = {}, glasses = {};
  for (const n of names) {
    const count = specs.filter((c) => c.variant === n).length;
    bodies[n] = new THREE.InstancedMesh(bodyGeos[n], paintMat, Math.max(count, 1));
    glasses[n] = new THREE.InstancedMesh(glassGeos[n], glassMat, Math.max(count, 1));
    bodies[n].count = count; glasses[n].count = count;
    bodies[n].name = `body-${n}`; glasses[n].name = `glass-${n}`;
    group.add(bodies[n], glasses[n]);
  }

  const tire = new THREE.CylinderGeometry(0.33, 0.33, 0.26, 20);
  tire.rotateX(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 14);
  rim.rotateX(Math.PI / 2);
  const wheelGeo = mergeGeometries([tire, rim], true);
  const wheels = new THREE.InstancedMesh(wheelGeo, [tireMat, rimMat], specs.length * 4);
  wheels.name = 'wheels';

  const lampGeo = new THREE.BoxGeometry(0.06, 0.12, 0.36);
  const lamps = new THREE.InstancedMesh(lampGeo, lightMat, specs.length * 4);
  lamps.name = 'lamps';
  const lampBase = new Float32Array(specs.length * 4 * 3);

  const idx = {}; for (const n of names) idx[n] = 0;
  specs.forEach((c, i) => {
    const v = VARIANTS[c.variant];
    dummy.position.set(c.x, 0, c.z);
    dummy.rotation.set(0, c.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    carMatrix.copy(dummy.matrix);

    const k = idx[c.variant]++;
    bodies[c.variant].setMatrixAt(k, carMatrix);
    bodies[c.variant].setColorAt(k, color.setHex(c.paint));
    glasses[c.variant].setMatrixAt(k, carMatrix);

    const ws = v.wheelR / 0.33;
    [[v.wheelX, v.wheelZ], [v.wheelX, -v.wheelZ], [-v.wheelX, v.wheelZ], [-v.wheelX, -v.wheelZ]].forEach(([wx, wz], j) => {
      local.makeScale(ws, ws, 1).setPosition(wx, v.wheelR, wz);
      wheels.setMatrixAt(i * 4 + j, carMatrix.clone().multiply(local));
    });

    const nose = v.body[v.body.length - 1][0] + 0.02;
    const tail = v.body[0][0] - 0.02;
    const rearY = v.body[1][1] + 0.06;
    [[nose, v.lightY, 0.62, 1], [nose, v.lightY, -0.62, 1], [tail, rearY, 0.6, 0], [tail, rearY, -0.6, 0]].forEach(([lx, ly, lz, front], j) => {
      local.identity().setPosition(lx, ly, lz);
      const id = i * 4 + j;
      lamps.setMatrixAt(id, carMatrix.clone().multiply(local));
      // Phares blanc chaud, feux arrière rouges, en valeurs HDR pour le bloom.
      const rgb = front ? [2.6, 2.25, 1.75] : [2.4, 0.16, 0.12];
      lampBase.set(rgb, id * 3);
      lamps.setColorAt(id, color.setRGB(rgb[0], rgb[1], rgb[2]));
    });
  });

  for (const n of names) {
    bodies[n].instanceMatrix.needsUpdate = true;
    if (bodies[n].instanceColor) bodies[n].instanceColor.needsUpdate = true;
    glasses[n].instanceMatrix.needsUpdate = true;
  }
  wheels.instanceMatrix.needsUpdate = true;
  lamps.instanceMatrix.needsUpdate = true;
  lamps.instanceColor.needsUpdate = true;
  group.add(wheels, lamps);

  return { group, specs, lamps, lampBase, materials: { paintMat, glassMat, rimMat } };
}
