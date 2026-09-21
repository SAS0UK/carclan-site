// Garde : le site publié ne dépose aucun cookie et n'embarque aucun traceur.
//
// La page /cookies/ promet l'absence de cookie et de mesure d'audience.
// Une promesse pareille vieillit mal : il suffit qu'un outil soit ajouté un
// jour pour qu'elle devienne fausse sans que personne le voie. Cette
// vérification lit les fichiers réellement produits dans `dist/` et casse le
// build au premier signe de traceur. Tant qu'elle passe, la page dit vrai.
//
// Elle cherche dans le résultat du build, pas dans les sources : c'est ce
// qui est servi aux visiteurs qui compte, dépendances comprises.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css']);

// Chaque motif dit ce qu'il cherche et pourquoi il est interdit ici.
const INTERDITS = [
  [/document\s*\.\s*cookie/, 'lecture ou écriture d’un cookie'],
  [/\blocalStorage\b/, 'stockage local du navigateur'],
  [/\bsessionStorage\b/, 'stockage de session du navigateur'],
  [/\bindexedDB\b/, 'base de données du navigateur'],
  [/googletagmanager|google-analytics|\bgtag\s*\(/, 'Google Analytics ou Tag Manager'],
  [/fonts\.googleapis|fonts\.gstatic/, 'polices servies par Google (elles voient passer la visite)'],
  [/connect\.facebook\.net|fbevents\.js/, 'pixel Meta'],
  [/static\.hotjar|hotjar\.com/, 'Hotjar'],
  [/matomo\.(js|php)|piwik\./, 'Matomo'],
  [/plausible\.io|umami\.is|segment\.(com|io)|mixpanel/, 'mesure d’audience tierce'],
  [/<iframe/i, 'iframe (souvent un traceur, et jamais nécessaire ici)'],
];

// Ce fichier-ci contient les motifs : il n'est évidemment pas dans dist/,
// mais la garde doit aussi se laisser relire sans se déclencher elle-même.
function fichiers(dossier) {
  const out = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
    else if (EXTENSIONS.has(extname(nom))) out.push(chemin);
  }
  return out;
}

let trouves = 0;
for (const chemin of fichiers(DIST)) {
  const contenu = readFileSync(chemin, 'utf8');
  for (const [motif, quoi] of INTERDITS) {
    const m = contenu.match(motif);
    if (!m) continue;
    // Le numéro de ligne aide à retrouver ce qui l'a introduit.
    const ligne = contenu.slice(0, m.index).split('\n').length;
    console.error(`  ${chemin.replace(DIST, 'dist')}:${ligne} — ${quoi} (« ${m[0]} »)`);
    trouves++;
  }
}

if (trouves) {
  console.error(`\ntraceurs : ${trouves} occurrence(s) trouvée(s) dans dist/.`);
  console.error('La page /cookies/ promet qu’il n’y en a aucune. Retirez le traceur,');
  console.error('ou réécrivez cette page et demandez le consentement avant de publier.');
  process.exit(1);
}

console.log('traceurs : aucun cookie ni traceur dans dist/, la page /cookies/ dit vrai');
