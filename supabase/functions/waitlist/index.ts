// Inscription à la liste d'attente de CarClan, avec double confirmation.
//
// Build 16 (faille haute de l'audit du 28 octobre 2026, décision de Mathys du
// 3 novembre) : la fonction envoyait un accusé de réception à chaque adresse
// neuve, sans aucune limite, sur le quota Resend des e-mails de connexion, et
// disait si une adresse était déjà inscrite. Désormais :
//
// - l'e-mail est un lien « Confirmez votre adresse » ; seule une adresse
//   confirmée est sur la liste (et dans le compteur public), une adresse non
//   confirmée est effacée au bout de 30 jours ;
// - les plafonds (par IP, pour tout le site, par adresse) et le choix
//   d'envoyer vivent dans la base, `waitlist_inscrire` (migration 0134), qui
//   ne s'appelle qu'avec la clé de service ;
// - la réponse au navigateur est la même que l'adresse soit neuve, déjà
//   inscrite, confirmée ou plafonnée : `fait`. Plus d'oracle ;
// - l'IP n'est jamais gardée : seulement son empreinte salée, deux jours.
//
// Deux appels, tous deux en POST depuis le site :
//   { email, consent_version, website }  → s'inscrire ;
//   { jeton }                            → confirmer (page /confirmer/).
// Confirmer passe par un bouton de la page, jamais par la seule ouverture du
// lien : les antivirus de messagerie ouvrent les liens tout seuls, et
// confirmeraient à la place de la personne.

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Le sel des empreintes d'IP. Sans secret dédié, la clé de service en tient
// lieu : elle ne quitte jamais le serveur.
const SEL_IP = Deno.env.get('WAITLIST_SEL') ?? CLE_SERVICE;
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
// police systeme, SF Pro sur iPhone), et certains clients bloquent les images.
// Le caractere vient donc de l'espace, de l'echelle, de l'ambre (le filet du
// haut, le mot-symbole, le bouton) et d'UNE image : le Maillon sur sol mouille.
// Elle n'est pas indispensable : bloquee, le mot-symbole et tout le texte
// restent. Son adresse est fixe, la meme pour tout le monde, jamais une par
// destinataire : ce n'est pas un pixel espion, la politique de
// confidentialite tient toujours.
const P = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const NUIT = '#0f0e0c', CRAIE = '#f3efe8', BITUME = '#8e897f', BITUME_CLAIR = '#aba69c';
const AMBRE = '#e2a21f', TRAIT = '#6e6a62', FILET = '#211f1d';

// L'image vit sur le site (`public/email/logo.png`, faite par
// `tools/email-logo.py`). L'app et le site ont le rendu « enseigne en
// relief » ; l'e-mail, et lui seul, garde le sol mouille : choix de Mathys
// du 3 novembre 2026, apres avoir vu les deux dans l'e-mail. Un nouveau
// logo = un nouveau fichier au meme chemin et une publication du site, sans
// toucher a cette fonction. Ses bords sont exactement NUIT, d'ou aucune
// arete sur le fond.
const LOGO = 'https://carclan.fr/email/logo.png';
const LOGO_COTE = 220;

const OBJET = 'Confirmez votre adresse pour CarClan';

// Le lien vaut 7 jours (`waitlist_inscrire`).
const LIEN = (jeton: string) => `https://carclan.fr/confirmer/?jeton=${jeton}`;

const TEXTE = (lien: string) => `Plus qu’un geste.

Confirmez votre adresse pour entrer sur la liste d’attente de CarClan.
On vous écrira le jour où l’application arrive sur iPhone et Android.

Confirmer mon adresse :
${lien}

Le lien vaut 7 jours.

Vous n’avez rien demandé ? Ignorez ce message : sans confirmation,
l’adresse est effacée sous 30 jours et vous ne recevrez plus rien.

https://carclan.fr
Tous les rassos. Un seul clan.`;

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
// se terminait trop net. Elles sont courtes (2 a 6 px, 58 en tout) : a 8 a
// 21 px, la lueur trop sombre pour se voir laissait 300 px de noir sous
// CARCLAN (retour de Mathys du 3 novembre 2026).
const bande = (h: number, fond: string) =>
  `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:${h}px;background:${fond};">&nbsp;</td></tr>`;

const lueurHaut = () => LUEUR.map((fond, i) => bande(2 + Math.round(i / 3), fond)).join('\n');

// Le Maillon puis le mot-symbole, sous la lueur. `alt` vide : le mot-symbole
// juste dessous dit deja CarClan, un lecteur d'ecran ne le lit pas deux fois.
const marque = () => `<tr><td align="center" style="padding:0 24px;font-size:0;line-height:0;">
<img src="${LOGO}" width="${LOGO_COTE}" height="${LOGO_COTE}" alt="" style="display:block;margin:0 auto;width:${LOGO_COTE}px;height:${LOGO_COTE}px;border:0;outline:none;" />
</td></tr>
<tr><td align="center" style="padding:4px 24px 0;"><span style="font:700 13px/1 ${P};letter-spacing:.24em;color:${AMBRE};">CARCLAN</span></td></tr>`;

const air = (h: number) => `<tr><td style="height:${h}px;font-size:0;line-height:${h}px;">&nbsp;</td></tr>`;

const html = (lien: string) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>Confirmez votre adresse</title>
</head>
<body style="margin:0;padding:0;background:${NUIT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Un geste pour entrer sur la liste d\u2019attente de CarClan.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NUIT};">
<tr><td style="height:3px;font-size:0;line-height:3px;background:${AMBRE};">&nbsp;</td></tr>
${lueurHaut()}
${marque()}

<tr><td align="center" style="padding:30px 12px 56px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

  <tr><td align="center" style="padding:0 24px;">
    <span style="font:600 11px/1 ${P};letter-spacing:.2em;text-transform:uppercase;color:${BITUME};">Liste d’attente</span>
  </td></tr>

  ${air(18)}
  <tr><td align="center" style="padding:0 20px;">
    <h1 style="margin:0;font:700 36px/1.06 ${P};letter-spacing:-.03em;color:${CRAIE};">Plus qu’un<br />geste.</h1>
  </td></tr>

  ${air(22)}
  <tr><td align="center" style="padding:0 24px;">
    <p style="margin:0;font:400 17px/1.65 ${P};color:${BITUME_CLAIR};">Confirmez votre adresse pour entrer sur la liste d’attente. On vous \u00e9crira le jour o\u00f9 CarClan arrive sur iPhone et Android.</p>
  </td></tr>

  ${air(38)}
  <tr><td align="center" style="padding:0 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="${AMBRE}" style="border-radius:999px;">
        <a href="${lien}" style="display:inline-block;padding:16px 34px;font:700 15px/1 ${P};letter-spacing:-.01em;color:#17140e;text-decoration:none;">Confirmer mon adresse</a>
      </td>
    </tr></table>
  </td></tr>

  ${air(56)}
  ${filet()}
  ${air(30)}
  <tr><td align="center" style="padding:0 28px;">
    <p style="margin:0;font:400 15px/1.7 ${P};color:${BITUME};">Le lien vaut 7&nbsp;jours. Vous n’avez rien demand\u00e9&nbsp;? Ignorez ce message&nbsp;: sans confirmation, l’adresse est effac\u00e9e sous 30&nbsp;jours.</p>
  </td></tr>

  ${air(38)}
  ${filet()}
  ${air(30)}
  <tr><td align="center" style="padding:0 24px;">
    <span style="font:600 11px/1.6 ${P};letter-spacing:.2em;text-transform:uppercase;color:${TRAIT};">Tous les rassos. Un seul clan.</span>
  </td></tr>

  ${air(18)}
  <tr><td align="center" style="padding:0 28px;">
    <p style="margin:0;font:400 12px/1.8 ${P};color:${TRAIT};">Vous recevez ce message parce que cette adresse a \u00e9t\u00e9 laiss\u00e9e sur <a href="https://carclan.fr" style="color:${BITUME};text-decoration:none;">carclan.fr</a>. Une question&nbsp;? \u00c9crivez \u00e0 <a href="mailto:contact@carclan.fr" style="color:${BITUME};text-decoration:none;">contact@carclan.fr</a>.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

async function prevenir(email: string, jeton: string) {
  if (!CLE_RESEND) return { envoye: false, raison: 'RESEND_API_KEY absente' };
  const lien = LIEN(jeton);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLE_RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EXPEDITEUR,
        to: [email],
        reply_to: 'contact@carclan.fr',
        subject: OBJET,
        text: TEXTE(lien),
        html: html(lien),
      }),
    });
    if (!res.ok) return { envoye: false, raison: `resend ${res.status} ${await res.text()}` };
    return { envoye: true };
  } catch (e) {
    return { envoye: false, raison: String(e) };
  }
}

const hex = (octets: ArrayBuffer) =>
  Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, '0')).join('');

const empreinte = async (texte: string) =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte)));

// 32 octets au hasard, en hexadécimal : 64 caractères, sans rien à échapper
// dans une adresse.
const nouveauJeton = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);

const JETON_VALIDE = /^[0-9a-f]{64}$/;

// L'IP vue par Supabase. `cf-connecting-ip` d'abord : c'est l'en-tête posé par
// le réseau de Supabase, pas par le client. `x-forwarded-for` en repli, sa
// première valeur.
const ipDe = (req: Request) =>
  req.headers.get('cf-connecting-ip') ??
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'inconnue';

const rpc = (nom: string, args: Record<string, unknown>) =>
  fetch(`${URL_SUPABASE}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: {
      apikey: CLE_SERVICE,
      Authorization: `Bearer ${CLE_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

Deno.serve(async (req: Request) => {
  const origine = req.headers.get('origin');
  const cors = entetes(origine);
  const repondre = (etat: string, status = 200) =>
    new Response(JSON.stringify({ etat }), { status, headers: cors });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return repondre('refus', 405);

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return repondre('refus', 400);
  }

  // Confirmer, depuis le bouton de la page /confirmer/.
  if (typeof corps.jeton === 'string') {
    const jeton = corps.jeton.trim().toLowerCase();
    if (!JETON_VALIDE.test(jeton)) return repondre('invalide');
    const res = await rpc('waitlist_confirmer', { p_confirmation_hash: await empreinte(jeton) });
    if (!res.ok) {
      console.error('confirmation refusée', res.status, await res.text());
      return repondre('echec', 502);
    }
    return repondre((await res.json()) === true ? 'confirme' : 'invalide');
  }

  // Le pot de miel du formulaire : un robot le remplit, une personne ne le
  // voit pas. On répond comme si tout allait bien, et rien ne part en base.
  if (typeof corps.website === 'string' && corps.website.trim() !== '') {
    return repondre('fait');
  }

  const email = String(corps.email ?? '').trim();
  if (!ressembleAUnEmail(email)) return repondre('invalide', 400);

  // `consent_version` dit quel texte la personne avait sous les yeux. On ne lui
  // invente pas de valeur par défaut : une preuve de consentement fabriquée ne
  // vaut rien, et la table la refuse déjà (NOT NULL, 1 à 32 caractères).
  const consentement = String(corps.consent_version ?? '').trim();
  if (consentement.length < 1 || consentement.length > 32) return repondre('invalide', 400);

  const jeton = nouveauJeton();
  const res = await rpc('waitlist_inscrire', {
    p_email: email,
    p_consent_version: consentement,
    p_ip_empreinte: await empreinte(`${SEL_IP}:${ipDe(req)}`),
    p_confirmation_hash: await empreinte(jeton),
  });
  if (!res.ok) {
    console.error('inscription refusée', res.status, await res.text());
    return repondre('echec', 502);
  }

  // `rien` (déjà confirmée, déjà écrite dans les 24 h, plafond atteint) et
  // `envoyer` répondent pareil au navigateur : c'est ce qui ferme l'oracle.
  if ((await res.json()) === 'envoyer') {
    const envoi = await prevenir(email, jeton);
    if (!envoi.envoye) console.error('confirmation non envoyée', envoi.raison);
  }
  return repondre('fait');
});
