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
// `noreply@carclan.fr` n'est PAS une boîte aux lettres : c'est une identité
// d'expédition, autorisée parce que le domaine carclan.fr est vérifié chez
// Resend. Rien n'arrive jamais à cette adresse, d'où le `reply_to` plus bas
// qui renvoie vers la vraie boîte OVH. Se change ici sans redéploiement.
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

// Le message. Deux contraintes d'e-mail commandent tout le reste : aucune
// police chargee ne survit (Archivo est donc impossible, on tombe sur la
// police systeme, SF Pro sur iPhone), et toute image est bloquee par defaut.
// Le caractere ne peut donc venir ni de la typo ni d'un visuel : il vient de
// l'espace, de l'echelle, et de l'ambre pose exactement trois fois — le filet
// du haut, le mot-symbole, le bouton. Zero image aussi veut dire zero pixel
// espion, ce que la politique de confidentialite promet deja.
const P = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const NUIT = '#0f0e0c', CRAIE = '#f3efe8', BITUME = '#8e897f', BITUME_CLAIR = '#aba69c';
const AMBRE = '#e2a21f', TRAIT = '#6e6a62', FILET = '#211f1d';

const OBJET = "C’est noté, vous êtes sur la liste";

const TEXTE = `Bienvenue dans le clan.

Merci d’être là avant tout le monde. On vous écrit dès que CarClan arrive
sur iPhone et Android.

Vous organisez des rassos, vous tenez un garage ou une enseigne ? Répondez
simplement à ce message.

https://carclan.fr
Tous les rassos. Un seul clan.

Vous recevez ce message parce que cette adresse a été laissée sur carclan.fr.
Pour sortir de la liste, écrivez à contact@carclan.fr, l’adresse est effacée.`;

// Un filet d'un pixel, pas une bordure : les bordures de tableau se dedoublent
// d'un client a l'autre, une rangee de 1 px de haut ne bouge jamais.
const filet = () =>
  `<tr><td style="padding:0 32px;"><div style="height:1px;font-size:0;line-height:1px;background:${FILET};">&nbsp;</div></td></tr>`;

// La lueur du lampadaire, en bandes de couleurs pleines. Gmail supprime les
// degrades CSS et les images de fond : un vrai degrade est donc impossible.
// Les paliers sont CALCULES, pas choisis : l'ambre fondu dans la nuit de 6 % a
// zero sur quatorze pas, ce qui fait exactement une unite RVB d'ecart par pas.
// Sur un fond sombre, deux unites se voient encore comme une bande, une non.
// La lueur occupe TOUTE la largeur du message : bornee a la colonne de 560,
// elle avait deux aretes verticales et se lisait comme un panneau colle.
const melange = (a: number) => {
  const A = [226, 162, 31], N = [15, 14, 12];
  return '#' + A.map((c, i) => Math.round(a * c + (1 - a) * N[i]).toString(16).padStart(2, '0')).join('');
};
const PAS = 14;
const LUEUR = Array.from({ length: PAS }, (_, i) => melange(0.06 * (1 - i / (PAS - 1))));

// Les bandes s'epaississent en descendant : pres de la lampe la lumiere change
// vite, loin d'elle elle traine. Des hauteurs egales donnaient une rampe qui
// se terminait trop net.
const bande = (h: number, fond: string) =>
  `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:${h}px;background:${fond};">&nbsp;</td></tr>`;

// Le mot-symbole vit dans le quatrieme palier, la ou la lumiere est encore
// pleine sans ecraser l'ambre du texte.
const RANG_MARQUE = 3;
const lueurHaut = (marque: string) =>
  LUEUR.map((fond, i) =>
    i === RANG_MARQUE
      ? `<tr><td align="center" style="padding:18px 24px 20px;background:${fond};">${marque}</td></tr>`
      : bande(8 + i, fond),
  ).join('\n');

const air = (h: number) => `<tr><td style="height:${h}px;font-size:0;line-height:${h}px;">&nbsp;</td></tr>`;

const html = () => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>C’est not\u00e9</title>
</head>
<body style="margin:0;padding:0;background:${NUIT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">On vous \u00e9crit d\u00e8s que CarClan arrive sur iPhone et Android.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NUIT};">
<tr><td style="height:3px;font-size:0;line-height:3px;background:${AMBRE};">&nbsp;</td></tr>
${lueurHaut(`<span style="font:700 13px/1 ${P};letter-spacing:.24em;color:${AMBRE};">CARCLAN</span>`)}

<tr><td align="center" style="padding:34px 12px 56px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

  <tr><td align="center" style="padding:0 24px;">
    <span style="font:600 11px/1 ${P};letter-spacing:.2em;text-transform:uppercase;color:${BITUME};">Liste d’attente</span>
  </td></tr>

  ${air(18)}
  <tr><td align="center" style="padding:0 20px;">
    <h1 style="margin:0;font:700 36px/1.06 ${P};letter-spacing:-.03em;color:${CRAIE};">Bienvenue<br />dans le clan.</h1>
  </td></tr>

  ${air(22)}
  <tr><td align="center" style="padding:0 24px;">
    <p style="margin:0;font:400 17px/1.65 ${P};color:${BITUME_CLAIR};">Merci d’\u00eatre l\u00e0 avant tout le monde. On vous \u00e9crit d\u00e8s que CarClan arrive sur iPhone et Android.</p>
  </td></tr>

  ${air(38)}
  <tr><td align="center" style="padding:0 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="${AMBRE}" style="border-radius:999px;">
        <a href="https://carclan.fr" style="display:inline-block;padding:16px 34px;font:700 15px/1 ${P};letter-spacing:-.01em;color:#17140e;text-decoration:none;">Voir le site</a>
      </td>
    </tr></table>
  </td></tr>

  ${air(56)}
  ${filet()}
  ${air(30)}
  <tr><td align="center" style="padding:0 28px;">
    <p style="margin:0;font:400 15px/1.7 ${P};color:${BITUME};">Vous organisez des rassos, vous tenez un garage ou une enseigne&nbsp;? R\u00e9pondez simplement \u00e0 ce message.</p>
  </td></tr>

  ${air(38)}
  ${filet()}
  ${air(30)}
  <tr><td align="center" style="padding:0 24px;">
    <span style="font:600 11px/1.6 ${P};letter-spacing:.2em;text-transform:uppercase;color:${TRAIT};">Tous les rassos. Un seul clan.</span>
  </td></tr>

  ${air(18)}
  <tr><td align="center" style="padding:0 28px;">
    <p style="margin:0;font:400 12px/1.8 ${P};color:${TRAIT};">Vous recevez ce message parce que cette adresse a \u00e9t\u00e9 laiss\u00e9e sur <a href="https://carclan.fr" style="color:${BITUME};text-decoration:none;">carclan.fr</a>. Pour sortir de la liste, \u00e9crivez \u00e0 <a href="mailto:contact@carclan.fr" style="color:${BITUME};text-decoration:none;">contact@carclan.fr</a>, l’adresse est effac\u00e9e.</p>
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
        subject: OBJET,
        text: TEXTE,
        html: html(),
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
