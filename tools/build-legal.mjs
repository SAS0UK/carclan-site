// Construit les quatre pages légales du site.
//
// Deux sources, jamais recopiées à la main :
//
// - `src/legal/site-documents.js` : les textes propres au site (ce que
//   carclan.fr collecte, qui l'édite, où il est hébergé). Ils sont écrits
//   pour le site et ne concernent pas l'application.
// - `src/legal/app-documents.json` : les textes de l'application, extraits
//   du code de CarClan par `tools/sync-legal.dart`. Ils sont repris mot pour
//   mot : Apple et Google exigent une politique de confidentialité publique,
//   et un site qui dirait autre chose que l'écran de l'app serait pire
//   qu'un site sans documents.
//
// Le script écrit `<dossier>/index.html` pour chacune des quatre pages, et
// Vite les prend ensuite comme entrées (voir vite.config.js). Lancé par
// `npm run build`, avant Vite.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(resolve(RACINE, 'src/legal/app-documents.json'), 'utf8'));
const { PAGES, SITE_VERSION } = await import('../src/legal/site-documents.js');

const echapper = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// Les textes portent quelques liens et mises en évidence, écrits en balisage
// minimal pour rester lisibles à la source : **gras**, [texte](url).
const enrichir = (s) => echapper(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, u) => {
    const externe = /^https?:/.test(u) && !u.includes('carclan.fr');
    return `<a href="${u}"${externe ? ' rel="noopener" target="_blank"' : ''}>${t}${externe ? ' <span class="sr-only">(nouvelle fenêtre)</span>' : ''}</a>`;
  });

const ancre = (s) => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

// Les identifiants de section doivent être uniques dans une page, sinon le
// sommaire ment : un navigateur envoie au PREMIER élément portant l'ancre.
//
// Deux origines se rencontrent dans ces pages, et elles emploient les mêmes
// intitulés : le texte du site et celui de l'application, repris mot pour mot.
// « Droit applicable » existait deux fois dans les CGU, « Vos droits » et
// « L'âge minimum » deux fois dans la confidentialité. Le lecteur qui cherchait
// les règles de l'application atterrissait sur celles du site, sans aucun
// signe que ce n'était pas la bonne section.
//
// Les sections de l'application prennent donc le suffixe `-app`, et un
// compteur ferme le cas où deux sections d'une même origine se nommeraient
// pareil : la page ne peut plus porter deux fois la même ancre, quoi qu'on
// écrive dans les textes.
function poserLesAncres(sections) {
  const vus = new Set();
  return sections.map((s) => {
    const base = ancre(s.titre) + (s.origine === 'app' ? '-app' : '');
    let id = base;
    for (let n = 2; vus.has(id); n++) id = `${base}-${n}`;
    vus.add(id);
    return { ...s, id };
  });
}

// Une section du site : { titre, blocs: [...] }, où un bloc est une chaîne
// (un paragraphe), { liste: [...] }, { encadre: [...] }, { defs: [[t, d]] }
// ou { tableau: { entetes, lignes } }.
function rendreBloc(b) {
  if (typeof b === 'string') return `<p>${enrichir(b)}</p>`;
  if (b.liste) return `<ul>${b.liste.map((x) => `<li>${enrichir(x)}</li>`).join('')}</ul>`;
  if (b.encadre) return `<div class="encadre">${b.encadre.map((x) => `<p>${enrichir(x)}</p>`).join('')}</div>`;
  if (b.defs) return `<dl class="defs">${b.defs.map(([t, d]) => `<div><dt>${enrichir(t)}</dt><dd>${enrichir(d)}</dd></div>`).join('')}</dl>`;
  if (b.tableau) {
    const { entetes, lignes } = b.tableau;
    return `<table class="tableau"><thead><tr>${entetes.map((h) => `<th scope="col">${enrichir(h)}</th>`).join('')}</tr></thead><tbody>${
      lignes.map((l) => `<tr>${l.map((c, i) => `<td data-col="${echapper(entetes[i])}">${enrichir(c)}</td>`).join('')}</tr>`).join('')
    }</tbody></table>`;
  }
  if (b.soustitre) return `<h3 class="t-sous-titre">${enrichir(b.soustitre)}</h3>`;
  throw new Error(`Bloc inconnu : ${JSON.stringify(b)}`);
}

// Une section reprise de l'application, telle qu'elle s'affiche à l'écran.
function sectionApp(s) {
  const paras = s.paragraphs.map((p) => `<p>${echapper(p)}</p>`).join('');
  const puces = s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${echapper(b)}</li>`).join('')}</ul>` : '';
  return { titre: s.heading, corps: paras + puces };
}

function construire(page) {
  const sections = [];

  for (const s of page.sections) {
    sections.push({ titre: s.titre, corps: s.blocs.map(rendreBloc).join(''), origine: 'site' });
  }

  // La partie « L'application », si la page en a une.
  if (page.app) {
    const doc = app[page.app];
    sections.push({
      titre: page.appTitre,
      corps: `<div class="encadre"><p>Ce qui suit est le texte affiché dans l’application CarClan, repris ici mot pour mot, dans sa version du ${echapper(app.updatedOn)}. Il est aussi lisible dans l’app, dans Profil puis Réglages.</p></div><p>${echapper(doc.intro)}</p>`,
      origine: 'site',
    });
    for (const s of doc.sections) sections.push({ ...sectionApp(s), origine: 'app' });
  }

  const avecAncres = poserLesAncres(sections);

  const sommaire = avecAncres
    .map((s) => `<li><a href="#${s.id}">${echapper(s.titre)}</a></li>`)
    .join('');

  const corps = avecAncres
    .map((s) => `<section id="${s.id}"><h2 class="t-titre">${echapper(s.titre)}</h2>${s.corps}</section>`)
    .join('');

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${echapper(page.titre)} · CarClan</title>
    <meta name="description" content="${echapper(page.description)}" />
    <meta name="theme-color" content="#0f0e0c" />
    <meta name="color-scheme" content="dark" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48" />
    <link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96" />
    <link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <link rel="canonical" href="https://carclan.fr/${page.chemin}/" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="CarClan" />
    <meta property="og:title" content="${echapper(page.titre)} · CarClan" />
    <meta property="og:description" content="${echapper(page.description)}" />
    <meta property="og:image" content="https://carclan.fr/og.png" />
    <meta property="og:image:alt" content="CarClan, les rassos près de chez vous" />
    <meta property="og:url" content="https://carclan.fr/${page.chemin}/" />
    <meta property="og:locale" content="fr_FR" />
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
      {"@type":"ListItem","position":1,"name":"CarClan","item":"https://carclan.fr/"},
      {"@type":"ListItem","position":2,"name":"${echapper(page.titre)}","item":"https://carclan.fr/${page.chemin}/"}
    ]}
    </script>
    <link rel="preload" href="/fonts/Archivo-var.woff2" as="font" type="font/woff2" crossorigin />
    <style>
      html { background: #0f0e0c; }
      body { margin: 0; }
    </style>
    <script type="module" src="/src/legal.js"></script>
  </head>
  <body>
    <a class="skip" href="#doc">Aller au contenu</a>

    <header class="legal-topbar">
      <a class="marque" href="/" aria-label="CarClan, accueil">
        <img src="/le-maillon.svg" alt="" width="28" height="28" />
        <span class="t-marque">CARCLAN</span>
      </a>
      <a class="retour" href="/"><svg class="ic" aria-hidden="true"><use href="#cc-suivant" /></svg>Retour au site</a>
    </header>

    <main id="doc" class="doc">
      <div class="doc-tete">
        <p class="t-surtitre">Informations légales</p>
        <h1 class="t-affiche">${echapper(page.titre)}</h1>
        <p class="version">Version du ${echapper(page.version)}.</p>
        <p class="chapeau">${enrichir(page.chapeau)}</p>
      </div>

      <div class="doc-grille">
        <nav class="sommaire" aria-label="Sommaire">
          <h2 class="t-surtitre">Sommaire</h2>
          <ol>${sommaire}</ol>
        </nav>
        <div class="doc-corps">${corps}</div>
      </div>
    </main>

    <footer class="pied">
      <div class="pied-haut">
        <a class="marque" href="/" aria-label="CarClan, accueil">
          <img src="/le-maillon.svg" alt="" width="28" height="28" />
          <span class="t-marque">CARCLAN</span>
        </a>
        <nav aria-label="Pied de page">
          <a href="mailto:contact@carclan.fr">contact@carclan.fr</a>
        </nav>
      </div>
      <div class="pied-bas">
        <nav aria-label="Informations légales">
          <a href="/mentions-legales/"${page.chemin === 'mentions-legales' ? ' aria-current="page"' : ''}>Mentions légales</a>
          <a href="/confidentialite/"${page.chemin === 'confidentialite' ? ' aria-current="page"' : ''}>Confidentialité</a>
          <a href="/cgu/"${page.chemin === 'cgu' ? ' aria-current="page"' : ''}>Conditions d’utilisation</a>
          <a href="/cookies/"${page.chemin === 'cookies' ? ' aria-current="page"' : ''}>Cookies</a>
        </nav>
        <span>© 2026 CarClan · Tourcoing</span>
      </div>
    </footer>
  </body>
</html>
`;
}

let n = 0;
for (const page of PAGES) {
  const dossier = resolve(RACINE, page.chemin);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(resolve(dossier, 'index.html'), construire(page), 'utf8');
  n++;
}

console.log(`légal : ${n} pages construites (site ${SITE_VERSION}, app ${app.updatedOn})`);
