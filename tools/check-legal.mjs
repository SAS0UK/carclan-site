// Garde : le site et l'application disent la même chose.
//
// Les pages /cgu/ et /confidentialite/ reprennent mot pour mot les textes de
// l'application, extraits par `tools/sync-legal.dart` vers
// `src/legal/app-documents.json`. Si les textes de l'app changent sans que
// cette extraction soit relancée, le site continue d'afficher l'ancienne
// version : une personne lirait sur carclan.fr des engagements que l'app ne
// prend plus, ce qui est exactement ce qu'un document légal ne doit pas
// faire.
//
// Cette vérification compare la version du JSON à celle du code de CarClan.
// Quand le dépôt de l'application n'est pas sur la machine (un déploiement
// depuis ailleurs, par exemple), elle le dit et laisse passer : elle ne peut
// pas comparer, elle ne va pas bloquer pour autant.

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_SITE = resolve(RACINE, 'src/legal/app-documents.json');
const DART_APP = resolve(homedir(), 'DEV/car_clan/lib/features/settings/domain/legal_documents.dart');

if (!existsSync(JSON_SITE)) {
  console.error('légal : src/legal/app-documents.json est absent.');
  console.error('Relancez : dart run tools/sync-legal.dart > src/legal/app-documents.json');
  process.exit(1);
}

const site = JSON.parse(readFileSync(JSON_SITE, 'utf8'));

if (!existsSync(DART_APP)) {
  console.log(`légal : app ${site.updatedOn} (dépôt CarClan absent, comparaison impossible)`);
  process.exit(0);
}

const dart = readFileSync(DART_APP, 'utf8');
const m = dart.match(/static\s+const\s+updatedOn\s*=\s*'([^']+)'/);

if (!m) {
  console.error('légal : impossible de lire `updatedOn` dans legal_documents.dart.');
  console.error('La constante a peut-être été renommée. Vérifiez à la main plutôt que de publier à l’aveugle.');
  process.exit(1);
}

if (m[1] !== site.updatedOn) {
  console.error(`légal : le site porte la version « ${site.updatedOn} », l’application « ${m[1]} ».`);
  console.error('Les textes de l’application ont changé. Relancez :');
  console.error('  ~/DEV/FLUTTER/flutter/bin/dart run tools/sync-legal.dart > src/legal/app-documents.json');
  process.exit(1);
}

console.log(`légal : site et application à la même version (${site.updatedOn})`);
