// SITE-8 : la politique de sécurité du contenu (CSP) des pages de dist/, posée
// au build, par empreintes.
//
// GitHub Pages n'accepte aucun en-tête personnalisé : la CSP passe par une
// balise <meta http-equiv>. Les pages portent des scripts et des styles en
// ligne (l'accueil, 404.html, qr/, confirmer/, les fiches de rasso
// pré-rendues, générés par quatre endroits différents). Plutôt que
// 'unsafe-inline', qui laisserait passer n'importe quel script injecté, ce
// fichier calcule le SHA-256 de chaque bloc en ligne tel qu'il est écrit dans
// dist/ et le met dans la CSP de sa propre page. Une page qui change son
// script change son empreinte au build suivant, sans rien à recopier.
//
// Ce que le <meta> ne sait pas faire (spécification) : frame-ancestors, sandbox
// et report-uri sont ignorés dans un <meta>. Le clickjacking par cadre reste
// donc ouvert tant qu'un vrai en-tête n'existe pas (CDN devant Pages).
// Permissions-Policy : idem, seulement en en-tête.
//
// Usage : `node tools/csp.mjs [dossier]` (par défaut dist/) pose la CSP puis la
// vérifie. `import { poserCsp, verifierCsp }` pour le banc.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SUPABASE = 'https://zheixbgssdfquresgtai.supabase.co';
const REFERRER = '<meta name="referrer" content="strict-origin-when-cross-origin">';

const SCRIPT = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gid;
const STYLE = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/gid;
const CSP_META = /[ \t]*<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>\s*/gi;

// Le navigateur hache le texte APRÈS la normalisation des fins de ligne de son
// analyseur HTML (CRLF et CR deviennent LF). Un fichier source en CRLF aurait
// donné une empreinte que le navigateur refuse : script et style bloqués, sans
// que le build le dise (trouvé à la relecture adverse, prouvé sous Chrome).
const empreinte = (texte) => `'sha256-${createHash('sha256').update(texte.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`;

// Remplace le contenu des commentaires HTML par des espaces, sans changer les
// positions : une balise écrite dans un commentaire n'existe pas pour le
// navigateur (un <meta charset> commenté ne doit pas recevoir la CSP).
const masquer = (html) => html.replace(/<!--[\s\S]*?-->/g, (c) => ' '.repeat(c.length));

// Un script en ligne EXÉCUTÉ : sans src, de type JavaScript (ou module).
// Un bloc de données (application/ld+json) n'est pas exécuté : la CSP ne le
// regarde pas.
function blocs(html, motif) {
  const masque = masquer(html);
  return [...masque.matchAll(motif)].map((m) => ({ attributs: m[1] ?? '', corps: html.slice(m.indices[2][0], m.indices[2][1]) }));
}

function scriptsEnLigne(html) {
  const blocs_ = [];
  for (const { attributs, corps } of blocs(html, SCRIPT)) {
    if (/\ssrc\s*=/i.test(` ${attributs}`)) continue;
    const type = /\stype\s*=\s*["']?([^\s"'>]+)/i.exec(` ${attributs}`)?.[1]?.toLowerCase();
    if (type && type !== 'module' && !/javascript|ecmascript/.test(type)) continue;
    blocs_.push(corps);
  }
  return blocs_;
}

const stylesEnLigne = (html) => blocs(html, STYLE).map((b) => b.corps);

export function politique(html) {
  const scripts = [...new Set(scriptsEnLigne(html).map(empreinte))];
  const styles = [...new Set(stylesEnLigne(html).map(empreinte))];
  return [
    `default-src 'self'`,
    `script-src 'self' ${scripts.join(' ')}`.trim(),
    `style-src 'self' ${styles.join(' ')}`.trim(),
    // data: : le grain de l'accueil est un SVG en data:, et Vite inline les
    // petits fichiers. Le stockage Supabase : couverture d'un rasso.
    `img-src 'self' data: ${SUPABASE}`,
    `font-src 'self'`,
    `connect-src 'self' ${SUPABASE}`,
    `manifest-src 'self'`,
    `media-src 'self'`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
}

// Pose (ou remplace) la CSP et, si la page n'en a pas, le referrer. Les deux
// balises vont juste après <meta charset> (qui doit rester dans les 1 024
// premiers octets), et avant tout script.
export function injecter(html) {
  const sansCsp = html.replace(CSP_META, '');
  const balises = [`<meta http-equiv="Content-Security-Policy" content="${politique(sansCsp)}">`];
  if (!/<meta\s+name=["']referrer["']/i.test(masquer(sansCsp))) balises.push(REFERRER);
  const bloc = balises.join('\n    ');
  const masque = masquer(sansCsp);
  const charset = /<meta\s+charset=[^>]*>/i.exec(masque);
  if (charset) {
    const fin = charset.index + charset[0].length;
    return `${sansCsp.slice(0, fin)}\n    ${bloc}${sansCsp.slice(fin)}`;
  }
  const head = /<head[^>]*>/i.exec(masque);
  if (!head) throw new Error('page sans <head> : CSP impossible à poser');
  const fin = head.index + head[0].length;
  return `${sansCsp.slice(0, fin)}\n    ${bloc}${sansCsp.slice(fin)}`;
}

function pages(dossier) {
  const trouvees = [];
  const parcourir = (d) => {
    for (const nom of readdirSync(d)) {
      const p = path.join(d, nom);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (nom.endsWith('.html')) trouvees.push(p);
    }
  };
  parcourir(dossier);
  return trouvees.sort();
}

export function poserCsp(dossier) {
  const liste = pages(dossier);
  for (const p of liste) writeFileSync(p, injecter(readFileSync(p, 'utf8')));
  return liste.length;
}

// Relit chaque page et dit ce qui ne va pas : pas de CSP, une CSP en double,
// un bloc en ligne sans son empreinte, 'unsafe-inline' ou 'unsafe-eval', un
// attribut de style ou de gestionnaire d'événement (que seule la permission
// 'unsafe-inline' laisserait passer), une ressource chargée d'un autre domaine
// que ceux de la politique. Elle ne prouve que la cohérence interne : seule une
// ouverture dans un navigateur prouve qu'une empreinte est acceptée.
export function verifierCsp(dossier) {
  const problemes = [];
  for (const p of pages(dossier)) {
    const nom = path.relative(dossier, p);
    const html = readFileSync(p, 'utf8');
    const metas = [...masquer(html).matchAll(CSP_META)].map((m) => [html.slice(m.index, m.index + m[0].length)]);
    if (metas.length !== 1) {
      problemes.push(`${nom} : ${metas.length} balise(s) Content-Security-Policy (une seule attendue)`);
      continue;
    }
    const contenu = /content="([^"]*)"/i.exec(metas[0][0])?.[1] ?? '';
    const directive = (n) => contenu.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${n} `)) ?? '';
    const script = directive('script-src');
    const style = directive('style-src');
    if (/'unsafe-(inline|eval)'/.test(contenu)) problemes.push(`${nom} : 'unsafe-inline' ou 'unsafe-eval' dans la politique`);
    if (!/default-src 'self'/.test(contenu)) problemes.push(`${nom} : default-src 'self' absent`);
    if (!/object-src 'none'/.test(contenu)) problemes.push(`${nom} : object-src 'none' absent`);
    const sansCsp = html.replace(CSP_META, '');
    for (const corps of scriptsEnLigne(sansCsp)) {
      if (!script.includes(empreinte(corps))) problemes.push(`${nom} : script en ligne sans empreinte (${corps.trim().slice(0, 50).replace(/\s+/g, ' ')}…)`);
    }
    for (const corps of stylesEnLigne(sansCsp)) {
      if (!style.includes(empreinte(corps))) problemes.push(`${nom} : style en ligne sans empreinte (${corps.trim().slice(0, 50).replace(/\s+/g, ' ')}…)`);
    }
    // Un hash qui ne correspond plus à rien : politique périmée.
    const attendus = new Set([...scriptsEnLigne(sansCsp), ...stylesEnLigne(sansCsp)].map(empreinte));
    for (const h of [...script.matchAll(/'sha256-[^']+'/g), ...style.matchAll(/'sha256-[^']+'/g)]) {
      if (!attendus.has(h[0])) problemes.push(`${nom} : empreinte sans bloc correspondant (${h[0].slice(0, 24)}…)`);
    }
    const sansBlocs = masquer(sansCsp).replace(SCRIPT, '').replace(STYLE, '');
    if (/<[a-z][^>]*\sstyle\s*=/i.test(sansBlocs)) problemes.push(`${nom} : attribut style="" (bloqué par la CSP)`);
    if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(sansBlocs)) problemes.push(`${nom} : gestionnaire on…="" (bloqué par la CSP)`);
    // Tout ce que la page CHARGE (script, feuille, image, police, manifeste) vient
    // d'elle-même, ou de Supabase pour les images. Un lien <a> ne charge rien.
    for (const [balise] of sansBlocs.matchAll(/<(script|img|source|video|audio|link|iframe|embed|object)\b[^>]*>/gi)) {
      if (/^<link\b/i.test(balise) && !/\brel\s*=\s*["']?(stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)/i.test(balise)) continue;
      for (const [, , , url] of balise.matchAll(/\s(src|href|srcset|poster)\s*=\s*(["'])(.*?)\2/gi)) {
        for (const candidat of url.split(',').map((u) => u.trim().split(/\s+/)[0])) {
          if (/^(https?:)?\/\//i.test(candidat) && !candidat.startsWith(SUPABASE)) {
            problemes.push(`${nom} : charge ${candidat.slice(0, 60)}, hors de la politique`);
          }
        }
      }
    }
    if (/<(iframe|object|embed)\b/i.test(sansBlocs)) problemes.push(`${nom} : iframe/object/embed (frame-src et object-src 'none')`);
  }
  return problemes;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const dossier = path.resolve(process.argv[2] ?? 'dist');
  const n = poserCsp(dossier);
  const problemes = verifierCsp(dossier);
  if (problemes.length > 0) {
    console.error(`[csp] ${problemes.length} problème(s) :\n - ${problemes.join('\n - ')}`);
    process.exit(1);
  }
  console.log(`[csp] ${n} page(s) : CSP par empreintes posée et vérifiée.`);
}
