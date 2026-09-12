// Fusionne les modèles de voitures (Kenney Car Kit, CC0 ; Quaternius Cars,
// CC0) en un seul GLB compressé meshopt. Chaque voiture devient une scène
// nommée. Lancer : node tools/build-cars.mjs <dossier-kenney-glb> <dossier-quaternius>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, meshopt, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';

const [kenneyDir, quatDir, racingFile] = process.argv.slice(2);
const KENNEY = ['sedan', 'sedan-sports', 'hatchback-sports', 'suv', 'suv-luxury', 'van', 'truck', 'truck-flat', 'delivery', 'race', 'race-future'];
const QUAT = ['sports-a', 'sports-b', 'car-a', 'car-b', 'suv'];

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

let target = null;
const add = async (file, key) => {
  const doc = await io.read(file);
  for (const scene of doc.getRoot().listScenes()) scene.setName(key);
  if (!target) { target = doc; return; }
  mergeDocuments(target, doc);
};
for (const k of KENNEY) await add(path.join(kenneyDir, `${k}.glb`), `k-${k}`);
for (const q of QUAT) await add(path.join(quatDir, `${q}.glb`), `q-${q}`);
if (racingFile) await add(racingFile, 'r-formula');

// Toutes les scènes doivent rester listées : mergeDocuments les conserve, mais
// le scene par défaut ne pointe que sur la première.
const scenes = target.getRoot().listScenes().map((s) => s.getName());
await target.transform(
  unpartition(),
  dedup(),
  prune({ keepAttributes: false, keepLeaves: false }),
  weld(),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
const out = 'public/models/cars.glb';
await io.write(out, target);
const { statSync } = await import('node:fs');
console.log('scenes:', scenes.join(', '));
console.log('written', out, (statSync(out).size / 1024).toFixed(0), 'KB');
