// Pose sur le JSON extrait par `sync-legal.dart` l'empreinte SHA-256 du fichier
// des textes de l'application (`sourceSha256`). `check-legal.mjs` la compare à
// celle du fichier actuel : une phrase qui change sans que la date bouge
// change l'empreinte, et le build refuse (SITE-6).
//
// Usage (voir `npm run sync-legal`) :
//   dart run tools/sync-legal.dart | node tools/stamp-legal.mjs > src/legal/app-documents.json
import { readFileSync } from 'node:fs';
import { APP_PAR_DEFAUT, cheminDart, empreinteDe } from './legal-source.mjs';

const json = JSON.parse(readFileSync(0, 'utf8'));
const empreinte = empreinteDe(cheminDart(APP_PAR_DEFAUT));
if (!empreinte) {
  console.error(`légal : ${cheminDart(APP_PAR_DEFAUT)} est absent, empreinte impossible.`);
  process.exit(1);
}
process.stdout.write(JSON.stringify({ ...json, sourceSha256: empreinte }, null, 2) + '\n');
