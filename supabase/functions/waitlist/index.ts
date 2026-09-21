// Inscription à la liste d'attente de CarClan, et accusé de réception.
//
// Pourquoi une fonction plutôt que l'insertion directe d'avant : il faut un
// secret (la clé Resend) pour envoyer le message, et un secret ne peut pas
// vivre dans une page. L'insertion elle-même n'a pas changé de nature, elle
// passe toujours par PostgREST avec la clé publiable, donc toujours sous les
// règles RLS de la table : `waitlist` n'accepte que l'insertion de trois
// colonnes, jamais la lecture.
//
// Règle qui tient tout le reste : l'e-mail est un supplément. Si Resend est
// absent, en panne ou lent, l'inscription est quand même enregistrée et la
// personne voit sa confirmation. On ne perd jamais une adresse pour un
// message qui n'est pas parti.

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CLE_PUBLIABLE = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLE_RESEND = Deno.env.get('RESEND_API_KEY') ?? '';
const EXPEDITEUR = Deno.env.get('WAITLIST_FROM') ?? 'CarClan <noreply@carclan.fr>';

// Le site est la seule origine attendue. `null` couvre les ouvertures de
// fichier local, l'aperçu Vite couvre le développement.
const ORIGINES = new Set([
  'https://carclan.fr',
  'https://www.carclan.fr',
  'http://localhost:5173',
  'http://localhost:4173',
]);

const entetes = (origine: string | null) => ({
  'Access-Control-Allow-Origin': origine && ORIGINES.has(origine) ? origine : 'https://carclan.fr',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
});

// Les mêmes bornes que les contraintes CHECK de la table : mieux vaut répondre
// « invalide » que laisser la base refuser et rendre un échec serveur.
const ressembleAUnEmail = (v: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length >= 6 && v.length <= 254;

const echapper = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Un seul message, en texte et en HTML. Le texte n'est pas un repli poli :
// c'est ce que lisent les clients qui bloquent le HTML, et son absence est un
// signal de courrier indésirable.
const TEXTE = `C'est noté.

Vous êtes sur la liste d'attente de CarClan. Le jour où l'application sort sur
iPhone et Android, vous recevez un message. Un seul, et rien d'autre : pas de
lettre d'information, pas de relance, aucune adresse transmise à qui que ce soit.

CarClan, c'est tous les rassos près de chez vous sur une carte, l'inscription en
un geste, et le fil du rasso qui continue après le rasso. On démarre dans les
Hauts-de-France.

Vous organisez des rassos, vous tenez un garage ou une enseigne, ou vous voulez
juste nous signaler les rendez-vous de votre coin ? Répondez à ce message, il
arrive sur contact@carclan.fr.

Pour sortir de la liste, il suffit de le demander à contact@carclan.fr, et
l'adresse est effacée.

https://carclan.fr
Tous les rassos. Un seul clan.`;

const html = (email: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="color-scheme" content="dark light" />
<title>C'est noté</title></head>
<body style="margin:0;padding:0;background:#0f0e0c;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Vous êtes sur la liste d'attente de CarClan. On vous écrit le jour de la sortie, et rien d'autre.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0e0c;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td style="padding-bottom:28px;">
    <span style="font:700 15px/1 Archivo,Helvetica,Arial,sans-serif;letter-spacing:.14em;color:#E2A21F;">CARCLAN</span>
  </td></tr>
  <tr><td style="padding-bottom:12px;">
    <span style="font:600 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#E2A21F;">Liste d'attente</span>
  </td></tr>
  <tr><td style="padding-bottom:18px;">
    <h1 style="margin:0;font:700 30px/1.15 Helvetica,Arial,sans-serif;color:#F5F1E8;">C'est noté.</h1>
  </td></tr>
  <tr><td style="padding-bottom:18px;font:400 16px/1.6 Helvetica,Arial,sans-serif;color:#CFC8BA;">
    Le jour où CarClan sort sur iPhone et Android, on écrit à
    <strong style="color:#F5F1E8;">${echapper(email)}</strong>.
    Un message, et rien d'autre : pas de lettre d'information, pas de relance,
    aucune adresse transmise à qui que ce soit.
  </td></tr>
  <tr><td style="padding:22px 0;border-top:1px solid #2A2621;border-bottom:1px solid #2A2621;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#CFC8BA;">
    CarClan, c'est tous les rassos près de chez vous sur une carte, l'inscription
    en un geste, et le fil du rasso qui continue après le rasso. On démarre dans
    les Hauts-de-France.
  </td></tr>
  <tr><td style="padding:22px 0 26px;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#CFC8BA;">
    Vous organisez des rassos, vous tenez un garage ou une enseigne, ou vous
    voulez nous signaler les rendez-vous de votre coin ? Répondez simplement à
    ce message.
  </td></tr>
  <tr><td style="padding-bottom:30px;">
    <a href="https://carclan.fr" style="display:inline-block;background:#E2A21F;color:#17140E;font:700 15px/1 Helvetica,Arial,sans-serif;text-decoration:none;padding:15px 26px;border-radius:999px;">Voir le site</a>
  </td></tr>
  <tr><td style="padding-top:22px;border-top:1px solid #2A2621;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#8C8579;">
    Tous les rassos. Un seul clan.<br />
    Vous recevez ce message parce que cette adresse a été laissée sur
    <a href="https://carclan.fr" style="color:#E2A21F;">carclan.fr</a>.
    Pour sortir de la liste, demandez-le à
    <a href="mailto:contact@carclan.fr" style="color:#E2A21F;">contact@carclan.fr</a>
    et l'adresse est effacée.
    <a href="https://carclan.fr/confidentialite/" style="color:#8C8579;">Confidentialité</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

async function prevenir(email: string) {
  if (!CLE_RESEND) return { envoye: false, raison: 'RESEND_API_KEY absente' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLE_RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EXPEDITEUR,
        to: [email],
        reply_to: 'contact@carclan.fr',
        subject: "C'est noté, on vous prévient à la sortie de CarClan",
        text: TEXTE,
        html: html(email),
        headers: { 'List-Unsubscribe': '<mailto:contact@carclan.fr?subject=Desinscription>' },
      }),
    });
    if (!res.ok) return { envoye: false, raison: `resend ${res.status} ${await res.text()}` };
    return { envoye: true };
  } catch (e) {
    return { envoye: false, raison: String(e) };
  }
}

Deno.serve(async (req: Request) => {
  const origine = req.headers.get('origin');
  const cors = entetes(origine);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('{"etat":"refus"}', { status: 405, headers: cors });

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return new Response('{"etat":"refus"}', { status: 400, headers: cors });
  }

  // Le pot de miel du formulaire : un robot le remplit, une personne ne le
  // voit pas. On répond comme si tout allait bien, et rien ne part en base.
  if (typeof corps.website === 'string' && corps.website.trim() !== '') {
    return new Response('{"etat":"fait"}', { status: 200, headers: cors });
  }

  const email = String(corps.email ?? '').trim();
  if (!ressembleAUnEmail(email)) {
    return new Response('{"etat":"invalide"}', { status: 400, headers: cors });
  }

  // `consent_version` dit quel texte la personne avait sous les yeux. On ne lui
  // invente pas de valeur par défaut : une preuve de consentement fabriquée ne
  // vaut rien, et la table la refuse déjà (NOT NULL, 1 à 32 caractères).
  const consentement = String(corps.consent_version ?? '').trim();
  if (consentement.length < 1 || consentement.length > 32) {
    return new Response('{"etat":"invalide"}', { status: 400, headers: cors });
  }

  const insertion = await fetch(`${URL_SUPABASE}/rest/v1/waitlist`, {
    method: 'POST',
    headers: {
      apikey: CLE_PUBLIABLE,
      Authorization: `Bearer ${CLE_PUBLIABLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    // `source` est figé : la table a un CHECK qui n'accepte que 'site', et le
    // laisser venir du client ne servait qu'à le faire refuser.
    body: JSON.stringify({ email, source: 'site', consent_version: consentement }),
  });

  // 409 : l'index unique sur lower(email). Déjà inscrite, donc pas de second
  // message — le premier a déjà été envoyé le jour où elle s'est inscrite.
  if (insertion.status === 409) {
    return new Response('{"etat":"deja"}', { status: 200, headers: cors });
  }

  if (insertion.status !== 201 && insertion.status !== 204) {
    console.error('insertion refusée', insertion.status, await insertion.text());
    return new Response('{"etat":"echec"}', { status: 502, headers: cors });
  }

  // L'adresse est en base : à partir d'ici la personne est inscrite, quoi
  // qu'il arrive au message. On l'attend quand même pour le tracer.
  const envoi = await prevenir(email);
  if (!envoi.envoye) console.error('accusé non envoyé', envoi.raison);

  return new Response(JSON.stringify({ etat: 'fait', accuse: envoi.envoye }), { status: 200, headers: cors });
});
