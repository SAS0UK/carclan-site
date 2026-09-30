// Pre-rend une page statique par rasso publie et public dans dist/rasso/<id>/,
// avec les balises Open Graph et le JSON-LD Event : c est ce que les robots
// d apercu de WhatsApp et de Facebook lisent quand un lien est colle dans un
// groupe. La page de secours (public/404.html) fait le meme rendu cote client
// pour un rasso pas encore pre-rendu, mais sans apercu.
//
// Pourquoi ici et pas dans une fonction Edge : la passerelle Supabase sert
// tout HTML d une fonction en text/plain avec une CSP sandbox sur son domaine
// par defaut (mesure le 13 septembre 2026), et un domaine personnalise
// Supabase est payant. GitHub Pages, lui, sert du HTML gratuitement.
//
// Lance par `npm run build` apres Vite. Sans RASSO_PAGES=1, il ne fait rien
// et le dit : tant que la base porte des rassos de demonstration, on ne les
// publie pas sur carclan.fr. Lecture avec la cle publiable, par les deux
// fonctions de la base ouvertes a `anon` (migration 0048) : jamais la liste
// des inscrits.

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = 'https://zheixbgssdfquresgtai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5BXrkwGrcB-YXA2uN5UqAA_mAY3iScd';
const SITE_URL = 'https://carclan.fr';
const DEFAULT_IMAGE = `${SITE_URL}/og.jpg`;
const OUT_DIR = path.resolve('dist', 'rasso');
// A remplacer par le vrai lien de la fiche App Store des la publication
// (TestFlight puis App Store, prevue le 25 octobre 2026). Meme repli que
// public/404.html.
const APP_STORE_URL = SITE_URL;

const TYPE_LABELS = {
  gathering: 'Rassemblement',
  official_motorsport: 'Motorsport officiel',
  track_day: 'Track day',
  exhibition: 'Exposition',
  legal_rally: 'Rallye',
  convoy: 'Balade',
  photo_session: 'Session photo',
  brand_meet: 'Rencontre marque',
  community_meet: 'Rencontre communauté',
  swap_meet: 'Bourse d’échange',
};
const ENTRY_LABELS = {
  free_entry: 'Entrée libre',
  registration: 'Sur inscription',
  paid_external: 'Payant, voir le site',
};
const EXTERNAL_LABELS = {
  registration: 'S’inscrire sur le site',
  paid_external: 'Billets sur le site',
  free_entry: 'Site de l’organisateur',
};

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    throw new Error(`${name} : HTTP ${response.status}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function capitalize(text) {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

function truncate(text, max) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

const fmt = (options) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...options });
const time = (date) => fmt({ hour: '2-digit', minute: '2-digit' }).format(date).replace(' ', '');

function formatDateLine(startsAt, endsAt) {
  const starts = new Date(startsAt);
  if (Number.isNaN(starts.getTime())) return { long: 'Date à confirmer', short: 'Date à confirmer' };
  const day = capitalize(fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(starts));
  let long = `${day} · ${time(starts)}`;
  const ends = endsAt ? new Date(endsAt) : null;
  if (ends && !Number.isNaN(ends.getTime())) {
    const short = (d) => fmt({ dateStyle: 'short' }).format(d);
    long += short(ends) === short(starts)
      ? ` à ${time(ends)}`
      : `, jusqu’au ${fmt({ day: 'numeric', month: 'long' }).format(ends)} ${time(ends)}`;
  }
  const shortDay = capitalize(fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(starts));
  return { long, short: `${shortDay} ${time(starts)}` };
}

function formatPrice(page) {
  if (page.is_free === true) return 'Gratuit';
  const amount = toNumber(page.price_amount);
  if (amount === null) return 'Payant';
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2).replace('.', ',')} ${page.currency || 'EUR'}`;
}

// Jamais « 0 inscrit ».
function formatParticipants(count) {
  const joined = Math.max(0, Math.trunc(toNumber(count) ?? 0));
  return joined <= 0 ? 'Soyez le premier' : `${joined} inscrit${joined === 1 ? '' : 's'}`;
}

function formatRating(average, count) {
  const rating = toNumber(average);
  const reviews = Math.trunc(toNumber(count) ?? 0);
  return rating === null || reviews <= 0 ? null : `${rating.toFixed(1).replace('.', ',')} sur ${reviews} avis`;
}

function acceptableExternalUrl(value) {
  const trimmed = (value ?? '').trim();
  if (trimmed === '' || /\s/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function coverImageUrl(coverPath) {
  const trimmed = (coverPath ?? '').trim();
  if (trimmed === '' || trimmed.includes('..')) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/event-covers/${trimmed.split('/').map(encodeURIComponent).join('/')}`;
}

// La feuille de style n est PAS ecrite ici : elle est extraite de
// public/404.html, entre ses deux marqueurs. Les deux pages rendent la meme
// fiche, et le seul moyen sur qu elles ne divergent pas est qu il n existe
// qu une source. Si les marqueurs disparaissent, le build s arrete plutot que
// de servir une page nue.
const STYLES = (() => {
  const secours = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8');
  const bloc = secours.match(/\/\* RASSO-STYLE:START \*\/([\s\S]*?)\/\* RASSO-STYLE:END \*\//);
  if (!bloc) {
    throw new Error('marqueurs RASSO-STYLE introuvables dans public/404.html');
  }
  return bloc[1];
})();

// Les dix pictogrammes de type, repris de tools/icons-sodium/type-*.svg du
// depot CarClan (la source de lib/shared/icons/cc_icon_data.dart), dans leur
// version du 29 septembre 2026 (commit a288a2f, « pour se lire sans
// legende ») : une voiture de face, le drapeau a damier, un volant, la
// voiture sur son socle, la tulipe du road book, la route qui serpente,
// l appareil photo, l ecusson aile, trois personnes, un ecrou. Grille 24.
// A reprendre ici ET dans public/404.html a chaque nouveau dessin.
const PICTOS = {
  gathering: '<path d="M5 11l2.5-6h9l2.5 6"/><rect x="3" y="11" width="18" height="6"/><circle cx="7" cy="14" r="1.6" fill="currentColor" stroke="none"/><circle cx="17" cy="14" r="1.6" fill="currentColor" stroke="none"/><rect x="4" y="17" width="4" height="4" fill="currentColor" stroke="none"/><rect x="16" y="17" width="4" height="4" fill="currentColor" stroke="none"/>',
  official_motorsport: '<path d="M4 2v20"/><rect x="5" y="3" width="16" height="12"/><rect x="5" y="3" width="4" height="4" fill="currentColor" stroke="none"/><rect x="13" y="3" width="4" height="4" fill="currentColor" stroke="none"/><rect x="9" y="7" width="4" height="4" fill="currentColor" stroke="none"/><rect x="17" y="7" width="4" height="4" fill="currentColor" stroke="none"/><rect x="5" y="11" width="4" height="4" fill="currentColor" stroke="none"/><rect x="13" y="11" width="4" height="4" fill="currentColor" stroke="none"/>',
  track_day: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="13" r="2.5" fill="currentColor" stroke="none"/><path d="M3.5 11h6M14.5 11h6M12 15.5V21"/>',
  exhibition: '<rect x="3" y="9" width="18" height="5" rx="1"/><path d="M5 9l2-4.5h10L19 9"/><circle cx="7.5" cy="14" r="1.6" fill="currentColor" stroke="none"/><circle cx="16.5" cy="14" r="1.6" fill="currentColor" stroke="none"/><path d="M2 17h20v4H2z" fill="currentColor" stroke="none"/>',
  legal_rally: '<circle cx="8" cy="19" r="2.5" fill="currentColor" stroke="none"/><path d="M8 17V4M8 11h7"/><path d="M14 6.5l6 4.5-6 4.5z" fill="currentColor" stroke="none"/>',
  convoy: '<path d="M1.5 22C4.22 15.62 14.89 12.16 11.7 4"/><path d="M21.5 22C15.44 17.58 21.94 8.54 15.3 4"/><path d="M11.5 22L11.29 19.12M12.09 16.63L13.1 14.78M14.23 12.79L14.84 11.34"/>',
  photo_session: '<rect x="2" y="7" width="20" height="14" rx="1"/><path d="M7.5 7l1.5-3h6l1.5 3"/><circle cx="12" cy="14" r="4.2" fill="currentColor" stroke="none"/><rect x="17" y="9.5" width="2.5" height="2" fill="currentColor" stroke="none"/>',
  brand_meet: '<path d="M6.9 7.2L1.1 7.2L2.7 10.4L6.9 10.4zM6.9 12.6L2.9 12.6L4.5 15.8L6.9 15.8zM17.1 7.2L17.1 10.4L21.3 10.4L22.9 7.2zM17.1 12.6L17.1 15.8L19.5 15.8L21.1 12.6z" fill="currentColor" stroke="none"/><path d="M17.4 12a5.4 5.4 0 1 1-10.8 0a5.4 5.4 0 1 1 10.8 0zM14.3 12a2.3 2.3 0 1 0-4.6 0a2.3 2.3 0 1 0 4.6 0z" fill="currentColor" stroke="none"/>',
  community_meet: '<circle cx="12" cy="6.8" r="3.3" fill="currentColor" stroke="none"/><path d="M5.5 21.5v-2a6.5 6.5 0 0 1 13 0v2z" fill="currentColor" stroke="none"/><circle cx="4.5" cy="8.3" r="2.5" fill="currentColor" stroke="none"/><path d="M1 17.5v-.6a3.6 3.6 0 0 1 3.5-3.6c.7 0 1.3.2 1.8.5a8.8 8.8 0 0 0-1.9 3.7z" fill="currentColor" stroke="none"/><circle cx="19.5" cy="8.3" r="2.5" fill="currentColor" stroke="none"/><path d="M23 17.5v-.6a3.6 3.6 0 0 0-3.5-3.6c-.7 0-1.3.2-1.8.5a8.8 8.8 0 0 1 1.9 3.7z" fill="currentColor" stroke="none"/>',
  swap_meet: '<path d="M7.5 4.2h9L21 12l-4.5 7.8h-9L3 12zM15.5 12a3.5 3.5 0 1 0-7 0a3.5 3.5 0 1 0 7 0z" fill="currentColor" stroke="none"/>',
};
const ITINERAIRE = '<path d="M5 20v-9a4 4 0 0 1 4-4h9M15 4l3 3-3 3"/>';
const VERIFIE = '<circle cx="12" cy="12" r="8"/><path d="M8.3 12.3l2.6 2.6 5-5.2" stroke-width="2.4"/>';

const svg = (formes) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${formes}</svg>`;

// « Sept. » : la colonne du bloc QUAND est etroite, le mois entier y
// pousserait l heure hors de l ecran. Meme regle que event_formatting.dart.
function moisAbrege(date) {
  const mois = fmt({ month: 'long' }).format(date);
  return mois.length <= 5 ? mois : `${mois.slice(0, 4)}.`;
}

// « Dans 3 jours », « Demain », « Aujourd hui ». Nul si c est passe ou a plus
// de trente jours. Le jour se compte a Paris : c est celui du rasso qui
// decide, pas le fuseau de la machine qui construit la page.
function compteARebours(date) {
  const enJours = (d) => {
    const [jour, mois, annee] = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('/');
    return Date.UTC(Number(annee), Number(mois) - 1, Number(jour)) / 86400000;
  };
  const jours = enJours(date) - enJours(new Date());
  if (jours < 0 || jours > 30) return null;
  if (jours === 0) return 'Aujourd’hui';
  if (jours === 1) return 'Demain';
  return `Dans ${jours} jours`;
}

// « jusqu a minuit », « jusqu a 18:00 », « jusqu au 12 octobre 18:00 ».
function libelleDeFin(starts, endsAt) {
  const ends = endsAt ? new Date(endsAt) : null;
  if (!ends || Number.isNaN(ends.getTime())) return null;
  const jour = (d) => fmt({ dateStyle: 'short' }).format(d);
  const minuit = time(ends) === '00:00';
  if (jour(ends) === jour(starts)) return minuit ? 'jusqu’à minuit' : `jusqu’à ${time(ends)}`;
  return `jusqu’au ${fmt({ day: 'numeric', month: 'long' }).format(ends)}${minuit ? '' : ` ${time(ends)}`}`;
}

// « VF » : les initiales de l organisateur, au plus deux.
function initiales(nom) {
  const mots = nom.split(/[\s._-]+/).filter(Boolean);
  return mots.slice(0, 2).map((m) => m.charAt(0).toUpperCase()).join('') || 'CC';
}

export function renderRassoPage(page) {
  const title = (page.title ?? '').trim() || 'Rasso';
  const canonicalUrl = `${SITE_URL}/rasso/${page.id}`;
  const dateLine = formatDateLine(page.starts_at, page.ends_at);
  const city = (page.address ?? '').split(',')[0].trim();
  const organizer = (page.organizer ?? '').trim() || 'Organisateur';
  const latitude = toNumber(page.latitude);
  const longitude = toNumber(page.longitude);
  const hasCoordinates = latitude !== null && longitude !== null;
  const coverUrl = coverImageUrl(page.cover_image_path);
  const image = coverUrl ?? DEFAULT_IMAGE;
  const externalUrl = acceptableExternalUrl(page.external_url);
  const description = (page.description ?? '').trim();
  const metaDescription = truncate([dateLine.short, city, `organisé par ${organizer}`].filter(Boolean).join(' · '), 150);
  const ratingLabel = formatRating(page.average_rating, page.review_count);
  const mapsUrl = hasCoordinates ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}` : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    startDate: new Date(page.starts_at).toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [image],
    url: canonicalUrl,
    organizer: { '@type': 'Organization', name: organizer },
    isAccessibleForFree: page.is_free === true,
  };
  if (description) jsonLd.description = truncate(description, 500);
  if (page.ends_at) jsonLd.endDate = new Date(page.ends_at).toISOString();
  if (page.address) {
    jsonLd.location = { '@type': 'Place', name: page.address, address: page.address };
    if (hasCoordinates) jsonLd.location.geo = { '@type': 'GeoCoordinates', latitude, longitude };
  }
  if (externalUrl) {
    jsonLd.offers = { '@type': 'Offer', url: externalUrl };
    if (page.is_free === true) Object.assign(jsonLd.offers, { price: 0, priceCurrency: page.currency || 'EUR' });
  }

  const paragraphs = description
    ? description.split(/\r?\n\s*\r?\n/).map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br>')}</p>`).join('')
    : '';

  // La fiche, dans l ordre de l ecran 1a : l affiche et son jour, le surtitre,
  // le titre, la description, l organisateur, puis QUAND, OU, ENTREE, AVIS.
  const starts = new Date(page.starts_at);
  const dateValide = !Number.isNaN(starts.getTime());
  const picto = PICTOS[page.type] ?? PICTOS.gathering;
  const echeance = dateValide ? compteARebours(starts) : null;
  const fin = dateValide ? libelleDeFin(starts, page.ends_at) : null;
  const address = (page.address ?? '').trim();
  const lieu = address ? address.split(',')[0].trim() : 'Lieu à confirmer';
  const situation = address.includes(',') ? address.slice(address.indexOf(',') + 1).trim() : '';
  const aUnOrganisateur = (page.organizer ?? '').trim() !== '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)} · CarClan</title>
<meta name="description" content="${escapeHtml(metaDescription)}">
<meta name="theme-color" content="#0F0E0C">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/icone-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/icone-48.png" type="image/png" sizes="48x48">
<link rel="icon" href="/icone-96.png" type="image/png" sizes="96x96">
<link rel="icon" href="/icone-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/Archivo-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CarClan">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(metaDescription)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(metaDescription)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<script type="application/ld+json">${safeJson(jsonLd)}</script>
<style>${STYLES}</style>
</head>
<body>
<main class="fiche">
  <header class="affiche">
    ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="">` : `<div class="affiche-vide">${svg(picto)}</div>`}
    <div class="voile"></div>
    <a class="enseigne" href="/">CARCLAN</a>
    <div class="jour">
      ${dateValide ? `<span class="jour-n">${escapeHtml(fmt({ day: 'numeric' }).format(starts))}</span>` : ''}
      <span class="jour-l label">${dateValide ? escapeHtml(`${fmt({ weekday: 'long' }).format(starts)} ${fmt({ month: 'long' }).format(starts)}`) : 'Date à confirmer'}</span>
    </div>
  </header>
  <div class="corps">
    <p class="surtitre label">
      <span class="puce"></span>
      <span class="type">${escapeHtml(TYPE_LABELS[page.type] ?? 'Rassemblement')}</span>
      ${echeance ? `<span>· ${escapeHtml(echeance)}</span>` : ''}
    </p>
    <h1>${escapeHtml(title)}</h1>
    ${paragraphs ? `<div class="description">${paragraphs}</div>` : ''}
    ${aUnOrganisateur ? `<div class="organisateur">
      <span class="avatar">${escapeHtml(initiales(organizer))}</span>
      <span>
        <span class="orga-nom">${escapeHtml(organizer)}</span>
        <span class="orga-role">Organisateur</span>
      </span>
    </div>` : ''}
    <section class="section">
      <p class="label">Quand</p>
      <div class="quand">
        ${dateValide ? `<span class="quand-n">${escapeHtml(fmt({ day: 'numeric' }).format(starts))}</span>` : ''}
        <span class="quand-col">
          <span class="quand-semaine label">${dateValide ? escapeHtml(fmt({ weekday: 'long' }).format(starts)) : 'Date'}</span>
          <span class="quand-mois label">${dateValide ? escapeHtml(`${moisAbrege(starts)} ${fmt({ year: 'numeric' }).format(starts)}`) : 'à confirmer'}</span>
        </span>
        <span class="quand-heure">
          ${dateValide ? `<span class="heure">${escapeHtml(time(starts))}</span>` : ''}
          ${fin ? `<span class="fin">${escapeHtml(fin)}</span>` : ''}
        </span>
      </div>
    </section>
    ${address || hasCoordinates ? `<section class="section">
      <p class="label">Où</p>
      <div class="ou">
        <div class="ou-texte">
          <p class="lieu">${escapeHtml(lieu)}</p>
          ${situation ? `<p class="situation">${escapeHtml(situation)}</p>` : ''}
        </div>
        ${mapsUrl ? `<a class="carre" href="${escapeHtml(mapsUrl)}" rel="noopener" aria-label="Y aller">${svg(ITINERAIRE)}</a>` : ''}
      </div>
      ${page.venue_authorized ? `<p class="autorise label">${svg(VERIFIE)}Lieu privé, autorisé ou toléré</p>` : ''}
    </section>` : ''}
    <section class="section">
      <p class="label">Entrée</p>
      <p class="entree"><span class="prix">${escapeHtml(formatPrice(page))}</span><span class="mode"> · ${escapeHtml(ENTRY_LABELS[page.entry_mode] ?? 'Entrée libre')}</span></p>
      <p class="inscrits">${escapeHtml(formatParticipants(page.participant_count))}</p>
      ${externalUrl ? `<a class="bouton bouton-contour" href="${escapeHtml(externalUrl)}" rel="noopener nofollow">${escapeHtml(EXTERNAL_LABELS[page.entry_mode] ?? 'Site de l’organisateur')}</a>` : ''}
    </section>
    ${ratingLabel ? `<section class="section">
      <p class="label">Avis</p>
      <p class="avis">${escapeHtml(ratingLabel)}</p>
    </section>` : ''}
    <p class="note">La liste des inscrits, les photos et les avis se voient dans l’application.</p>
  </div>
</main>
<footer class="barre">
  <div class="barre-contenu">
    <a class="bouton bouton-ambre" id="open-app" href="carclan://events/${escapeHtml(page.id)}" rel="noopener">Ouvrir dans CarClan</a>
  </div>
</footer>
<script>
  // Ouvre l'app par son schema, et si rien n'a pris la main (la page reste
  // visible passe un delai court), retombe sur l'App Store. Meme mecanique
  // que public/404.html, voir son commentaire pour le detail.
  (function () {
    var a = document.getElementById('open-app');
    if (!a) return;
    a.addEventListener('click', function (event) {
      event.preventDefault();
      var scheme = a.getAttribute('href');
      var tookOver = false;
      function onHide() { if (document.hidden) tookOver = true; }
      document.addEventListener('visibilitychange', onHide);
      window.location.href = scheme;
      setTimeout(function () {
        document.removeEventListener('visibilitychange', onHide);
        if (!tookOver) window.location.href = ${JSON.stringify(APP_STORE_URL)};
      }, 1500);
    });
  })();
</script>
</body>
</html>
`;
}

async function main() {
  if (process.env.RASSO_PAGES !== '1') {
    console.log('[rassos] pages statiques non generees (RASSO_PAGES=1 pour les publier ; pas tant que la base porte des rassos de demonstration).');
    return;
  }

  const ids = await rpc('list_public_event_ids');
  let written = 0;
  for (const row of ids) {
    const page = await rpc('public_event_page', { target_event_id: row.id });
    if (!page || typeof page !== 'object' || !page.id) continue;
    const dir = path.join(OUT_DIR, page.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), renderRassoPage(page), 'utf8');
    written += 1;
  }
  console.log(`[rassos] ${written} page(s) statique(s) dans dist/rasso/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error('[rassos] echec :', error.message);
    process.exitCode = 1;
  });
}
