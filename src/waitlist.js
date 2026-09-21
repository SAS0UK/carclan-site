// Liste d'attente : une insertion REST dans public.waitlist (migration 0046 du
// dépôt CarClan). La clé publiable est publique par construction : la table
// n'accepte que l'insertion de trois colonnes, sans lecture ni modification.
//
// La version du consentement vient de `legal-version.js`, la même que celle
// affichée en tête de la politique de confidentialité : c'est ce qui permet
// de savoir, plus tard, quel texte la personne avait sous les yeux.
import { CONSENT_VERSION } from './legal-version.js';

const SUPABASE_URL = 'https://zheixbgssdfquresgtai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5BXrkwGrcB-YXA2uN5UqAA_mAY3iScd';

export { CONSENT_VERSION };

const MESSAGES = {
  invalide: 'Cette adresse ne ressemble pas à une adresse e-mail.',
  envoi: 'Un instant…',
  fait: 'C’est noté. On vous écrit le jour de la sortie.',
  deja: 'Cette adresse est déjà sur la liste. À bientôt.',
  echec: 'Impossible d’enregistrer pour le moment. Écrivez à contact@carclan.fr, on vous ajoute à la main.',
};

const ressembleAUnEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

export function setupWaitlist(form) {
  if (!form) return;
  const champ = form.querySelector('input[type="email"]');
  const potDeMiel = form.querySelector('input[name="website"]');
  const etat = form.querySelector('.etat-envoi');
  const bouton = form.querySelector('button[type="submit"]');
  if (!champ || !etat || !bouton) return;

  // L'état est annoncé par `aria-live` (voir le gabarit) : il se lit au
  // lecteur d'écran sans déplacer le focus. L'erreur porte une icône en plus
  // de la couleur, la couleur seule ne disant rien à qui ne la voit pas.
  const dire = (cle, erreur = false) => {
    etat.textContent = MESSAGES[cle];
    etat.classList.toggle('erreur', erreur);
    champ.setAttribute('aria-invalid', erreur ? 'true' : 'false');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = champ.value.trim();

    // Le pot de miel : un robot le remplit, une personne ne le voit pas. On
    // ne lui dit pas qu'il est repéré, et rien ne part en base.
    if (potDeMiel && potDeMiel.value) {
      form.classList.add('done');
      dire('fait');
      return;
    }

    if (!ressembleAUnEmail(email)) {
      dire('invalide', true);
      champ.focus();
      return;
    }

    bouton.disabled = true;
    dire('envoi');

    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), 9000);

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
        method: 'POST',
        signal: controleur.signal,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email, source: 'site', consent_version: CONSENT_VERSION }),
      });

      if (res.status === 201 || res.status === 204) {
        form.classList.add('done');
        dire('fait');
      } else if (res.status === 409) {
        // L'index unique sur lower(email) : déjà inscrite, ce n'est pas une
        // erreur de la personne.
        form.classList.add('done');
        dire('deja');
      } else {
        dire('echec', true);
        bouton.disabled = false;
      }
    } catch {
      dire('echec', true);
      bouton.disabled = false;
    } finally {
      clearTimeout(minuteur);
    }
  });
}
