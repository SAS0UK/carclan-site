// Ce que partagent les deux pages de passage des e-mails d'authentification de
// l'app (EDGE-10). Sans CSS ni DOM : le banc `tools/test-pages-compte.mjs` le
// charge tel quel.
const SUPABASE = 'https://zheixbgssdfquresgtai.supabase.co';
// La clé publique du site (la même que src/waitlist.js) : elle ne donne que le
// droit d'appeler l'API d'authentification, comme dans l'app.
const CLE_PUBLIQUE = 'sb_publishable_5BXrkwGrcB-YXA2uN5UqAA_mAY3iScd';

// Le `token_hash` de Supabase : des caractères hexadécimaux, parfois précédés
// de `pkce_`. Rien d'autre ne passe, ni dans l'API ni dans le lien de l'app.
const FORME = /^[A-Za-z0-9_-]{20,200}$/;

export const jetonDuLien = (recherche) => {
  const brut = (new URLSearchParams(recherche).get('token_hash') ?? '').trim();
  return FORME.test(brut) ? brut : '';
};

// L'ouverture de l'app sur son écran de nouveau mot de passe : c'est l'app qui
// consomme le jeton, pas cette page.
export const lienApp = (jeton) => `carclan://reset-password?token_hash=${encodeURIComponent(jeton)}&type=recovery`;

export const MESSAGES = {
  mort: [
    'Ce lien ne marche plus.',
    'Il a déjà servi, ou il a expiré. Ouvrez l’app CarClan, touchez « Renvoyer l’e-mail » sur l’écran de confirmation, puis utilisez le tout dernier message reçu.',
  ],
};

// Appelle l'API d'authentification de Supabase (`verifyOtp` : type `email` pour
// le token_hash d'une inscription). Rend 'confirme', 'mort' (lien expiré, déjà
// utilisé ou faux) ou 'reessayer' (réseau, serveur, trop de demandes).
export async function verifier(jeton, appeler = fetch) {
  try {
    const res = await appeler(`${SUPABASE}/auth/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CLE_PUBLIQUE },
      body: JSON.stringify({ type: 'email', token_hash: jeton }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return 'confirme';
    if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410 || res.status === 422) return 'mort';
    return 'reessayer';
  } catch {
    return 'reessayer';
  }
}
