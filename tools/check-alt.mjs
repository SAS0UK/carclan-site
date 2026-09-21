// Garde : aucune image publiée sans texte de remplacement.
//
// Une image sans `alt` est invisible pour qui navigue au lecteur d'écran, et
// illisible pour un agent qui lit la page. Une image décorative doit porter
// `alt=""` explicitement : c'est ce qui dit « il n'y a rien à lire ici »,
// alors qu'un attribut absent veut dire « on a oublié ».
//
// La vérification porte sur dist/, donc sur ce qui est réellement servi.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function pages(dossier) {
  const out = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...pages(chemin));
    else if (extname(nom) === '.html') out.push(chemin);
  }
  return out;
}

let manquants = 0;
let total = 0;

for (const chemin of pages(DIST)) {
  const html = readFileSync(chemin, 'utf8');
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    total++;
    if (/\salt\s*=/.test(m[0])) continue;
    const ligne = html.slice(0, m.index).split('\n').length;
    console.error(`  ${chemin.replace(DIST, 'dist')}:${ligne} — <img> sans alt : ${m[0].slice(0, 90)}…`);
    manquants++;
  }
}

if (manquants) {
  console.error(`\nalt : ${manquants} image(s) sans texte de remplacement sur ${total}.`);
  console.error('Décrivez ce que montre l’image, ou posez alt="" si elle est décorative.');
  process.exit(1);
}

console.log(`alt : ${total} image(s), toutes avec un texte de remplacement`);
