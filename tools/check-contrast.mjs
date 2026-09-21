// Garde : les couples de couleurs interdits ne passent pas.
//
// Deux erreurs sont faciles à commettre avec la palette Sodium, et se voient
// mal à l'œil sur un écran de bureau bien réglé :
//
// - **de la craie sur de l'ambre** : 1,94:1, illisible. L'ambre est un fond,
//   ce qui s'écrit dessus s'écrit en nuit (8,66:1).
// - **du bitume sur de la surface 2** : 4,44:1, sous le seuil AA pour du
//   texte courant. Acceptable à partir de 18 px ou en gras, pas en dessous.
//
// La vérification lit les feuilles de style du site, repère les blocs qui
// fixent à la fois une couleur de texte et un fond, et refuse ces couples.
// Elle ne remplace pas un audit complet : elle empêche la faute connue de
// revenir. Les ratios eux-mêmes sont recalculés ici à partir des jetons, et
// non recopiés, pour qu'un changement de palette soit détecté.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FEUILLES = ['src/tokens.css', 'src/site.css', 'src/legal.css'];

const tokens = readFileSync(resolve(RACINE, 'src/tokens.css'), 'utf8');
function jeton(nom) {
  const m = tokens.match(new RegExp(`--${nom}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`jeton --${nom} introuvable dans tokens.css`);
  return m[1];
}

const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Les couples interdits, avec le seuil qu'ils doivent atteindre.
const COUPLES = [
  { texte: 'craie', fond: 'ambre', min: 4.5, note: 'l’ambre est un fond : écrivez en nuit dessus' },
  { texte: 'bitume', fond: 'surface-2', min: 4.5, note: 'passez en craie, ou en bitume clair' },
];

let erreurs = 0;

for (const { texte, fond, min, note } of COUPLES) {
  const r = ratio(jeton(texte), jeton(fond));
  if (r >= min) {
    console.log(`contraste : --${texte} sur --${fond} vaut désormais ${r.toFixed(2)}:1, la règle peut être revue`);
    continue;
  }
  // Le couple est bien mauvais : on vérifie qu'aucune feuille ne l'emploie.
  for (const f of FEUILLES) {
    const css = readFileSync(resolve(RACINE, f), 'utf8');
    for (const bloc of css.matchAll(/\{([^{}]*)\}/g)) {
      const d = bloc[1];
      const aTexte = new RegExp(`(?:^|[^-])color\\s*:\\s*var\\(\\s*--${texte}\\s*\\)`).test(d);
      const aFond = new RegExp(`background(?:-color)?\\s*:[^;]*var\\(\\s*--${fond}\\s*\\)`).test(d);
      if (aTexte && aFond) {
        const ligne = css.slice(0, bloc.index).split('\n').length;
        console.error(`  ${f}:${ligne} — --${texte} sur --${fond} : ${r.toFixed(2)}:1, sous ${min}:1. ${note}`);
        erreurs++;
      }
    }
  }
}

if (erreurs) {
  console.error(`\ncontraste : ${erreurs} couple(s) interdit(s).`);
  process.exit(1);
}

console.log('contraste : aucun couple interdit dans les feuilles du site');
