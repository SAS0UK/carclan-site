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

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = 'https://zheixbgssdfquresgtai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5BXrkwGrcB-YXA2uN5UqAA_mAY3iScd';
const SITE_URL = 'https://carclan.fr';
const DEFAULT_IMAGE = `${SITE_URL}/og.png`;
const OUT_DIR = path.resolve('dist', 'rasso');

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

const STYLES = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: #0b0b0d; color: #f2ece6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; }
a { color: #e6b8a2; }
.page { max-width: 640px; margin: 0 auto; padding: 16px 16px 40px; }
.cover { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 16px; background: linear-gradient(135deg, #2b2b31, #1a1a1f); }
.card { margin-top: 16px; background: #1a1a1f; border: 1px solid rgba(230, 184, 162, 0.08); border-radius: 16px; padding: 24px; }
.overline { margin: 0 0 12px; color: #e6b8a2; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; }
h1 { margin: 0 0 20px; font-size: 30px; line-height: 1.15; letter-spacing: -0.01em; }
h2 { margin: 24px 0 8px; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #c9b8a6; font-weight: 600; }
.facts { margin: 0; display: grid; gap: 12px; }
.facts div { display: grid; grid-template-columns: 110px 1fr; gap: 12px; border-top: 1px solid rgba(230, 184, 162, 0.08); padding-top: 12px; }
.facts dt { margin: 0; color: #c9b8a6; font-size: 14px; }
.facts dd { margin: 0; font-size: 16px; }
.actions { display: grid; gap: 10px; margin-top: 24px; }
.button { display: block; text-align: center; padding: 14px 18px; border-radius: 12px; border: 1px solid rgba(230, 184, 162, 0.48); color: #f2ece6; text-decoration: none; font-weight: 600; }
.button.primary { background: #8e1d2d; border-color: #8e1d2d; }
.button.download { margin-top: 12px; }
.description p { margin: 0 0 12px; }
.note { margin: 24px 0 0; color: #c9b8a6; font-size: 14px; }
footer { margin-top: 24px; text-align: center; color: #c9b8a6; font-size: 13px; }
`;

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

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · CarClan</title>
<meta name="description" content="${escapeHtml(metaDescription)}">
<meta name="theme-color" content="#0b0b0d">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
<main class="page">
  ${coverUrl ? `<img class="cover" src="${escapeHtml(coverUrl)}" alt="">` : '<div class="cover"></div>'}
  <article class="card">
    <p class="overline">${escapeHtml(TYPE_LABELS[page.type] ?? 'Rassemblement')}</p>
    <h1>${escapeHtml(title)}</h1>
    <dl class="facts">
      <div><dt>Quand</dt><dd>${escapeHtml(dateLine.long)}</dd></div>
      ${page.address ? `<div><dt>Où</dt><dd>${escapeHtml(page.address)}</dd></div>` : ''}
      <div><dt>Organisé par</dt><dd>${escapeHtml(organizer)}</dd></div>
      <div><dt>Entrée</dt><dd>${escapeHtml(ENTRY_LABELS[page.entry_mode] ?? 'Entrée libre')} · ${escapeHtml(formatPrice(page))}</dd></div>
      <div><dt>Inscrits</dt><dd>${escapeHtml(formatParticipants(page.participant_count))}</dd></div>
      ${ratingLabel ? `<div><dt>Avis</dt><dd>${escapeHtml(ratingLabel)}</dd></div>` : ''}
      ${page.venue_authorized ? '<div><dt>Lieu</dt><dd>Lieu privé ou autorisé</dd></div>' : ''}
    </dl>
    <div class="actions">
      <a class="button primary" href="carclan://events/${escapeHtml(page.id)}">Ouvrir dans CarClan</a>
      ${mapsUrl ? `<a class="button" href="${escapeHtml(mapsUrl)}" rel="noopener">Y aller</a>` : ''}
      ${externalUrl ? `<a class="button" href="${escapeHtml(externalUrl)}" rel="noopener nofollow">${escapeHtml(EXTERNAL_LABELS[page.entry_mode] ?? 'Site de l’organisateur')}</a>` : ''}
    </div>
    ${paragraphs ? `<section class="description"><h2>Description</h2>${paragraphs}</section>` : ''}
    <p class="note">La liste des inscrits, les photos et les avis se voient dans l’application.</p>
    <a class="button download" href="${SITE_URL}" rel="noopener">Télécharger CarClan</a>
  </article>
  <footer>Publié sur CarClan · <a href="${SITE_URL}">carclan.fr</a></footer>
</main>
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
