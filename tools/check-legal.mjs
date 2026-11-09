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
import { APP_PAR_DEFAUT, cheminDart, empreinteDe } from './legal-source.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// `CARCLAN_LEGAL_JSON` : un autre JSON à comparer (le banc de ce contrôle).
const JSON_SITE = process.env.CARCLAN_LEGAL_JSON ?? resolve(RACINE, 'src/legal/app-documents.json');
// `CARCLAN_APP` : le dossier de l'app à comparer, quand le site part d'une
// branche dont les textes ne sont pas encore dans `main` (build 16, 3 novembre
// 2026). Par défaut, `~/DEV/car_clan`.
const DART_APP = cheminDart(process.env.CARCLAN_APP ?? APP_PAR_DEFAUT);

if (!existsSync(JSON_SITE)) {
  console.error('légal : src/legal/app-documents.json est absent.');
  console.error('Relancez : dart run tools/sync-legal.dart | node tools/stamp-legal.mjs > src/legal/app-documents.json');
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
  console.error('  ~/DEV/FLUTTER/flutter/bin/dart run tools/sync-legal.dart | node tools/stamp-legal.mjs > src/legal/app-documents.json');
  process.exit(1);
}

// L'empreinte (SITE-6) : la date seule ne voit pas une phrase qui change sans
// elle. `sourceSha256` est celle du fichier de l'app au moment de la
// synchronisation (`npm run sync-legal`).
if (!site.sourceSha256) {
  console.log(`légal : site et application à la même date (${site.updatedOn}), mais le JSON n’a pas d’empreinte :`);
  console.log('  relancez `npm run sync-legal` pour que le texte, et plus seulement la date, soit contrôlé.');
  process.exit(0);
}

const empreinte = empreinteDe(DART_APP);
if (empreinte !== site.sourceSha256) {
  console.error(`légal : la date est la même (${site.updatedOn}) mais le texte de l’application a changé depuis la dernière synchronisation.`);
  console.error('Relancez :  npm run sync-legal');
  process.exit(1);
}

console.log(`légal : site et application à la même version (${site.updatedOn}), même empreinte`);
