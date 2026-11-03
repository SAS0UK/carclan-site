// La page du lien de confirmation de la liste d'attente (build 16, double
// confirmation). Elle ne confirme rien en s'ouvrant : les antivirus de
// messagerie ouvrent les liens d'eux-mêmes, et confirmeraient à la place de la
// personne. C'est le bouton qui envoie le jeton à la fonction `waitlist`.
import './tokens.css';
import './legal.css';
import { mountIcons } from './icons.js';

mountIcons();

const URL_FONCTION = 'https://zheixbgssdfquresgtai.supabase.co/functions/v1/waitlist';

const jeton = (new URLSearchParams(location.search).get('jeton') ?? '').trim().toLowerCase();
const bouton = document.querySelector('[data-confirmer]');
const libelle = bouton?.querySelector('[data-libelle]');
const titre = document.querySelector('[data-titre]');
const chapeau = document.querySelector('[data-chapeau]');
const etat = document.querySelector('[data-etat]');

// Le jeton n'a plus rien à faire dans la barre d'adresse une fois lu : ni dans
// l'historique, ni dans une capture d'écran partagée.
if (jeton) history.replaceState(null, '', location.pathname);

const finir = (t, c) => {
  if (titre) titre.textContent = t;
  if (chapeau) chapeau.textContent = c;
  if (etat) etat.textContent = '';
  bouton?.remove();
  titre?.focus();
};

const LIEN_MORT = [
  'Ce lien ne marche plus.',
  'Il a plus de 7 jours, ou il a été mal copié. Laisse à nouveau ton adresse sur carclan.fr pour en recevoir un nouveau (un par jour au plus).',
];

if (!/^[0-9a-f]{64}$/.test(jeton)) {
  finir(...LIEN_MORT);
} else {
  bouton?.addEventListener('click', async () => {
    bouton.disabled = true;
    if (libelle) libelle.textContent = 'Un instant…';
    try {
      const res = await fetch(URL_FONCTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jeton }),
        signal: AbortSignal.timeout(15000),
      });
      const rendu = res.ok ? (await res.json().catch(() => ({}))).etat : null;
      if (rendu === 'confirme') {
        finir('T’es sur la liste.', 'Bienvenue dans le clan. On t’écrit le jour de la sortie, et rien d’autre.');
      } else if (rendu === 'invalide') {
        finir(...LIEN_MORT);
      } else {
        throw new Error(String(rendu));
      }
    } catch {
      bouton.disabled = false;
      if (libelle) libelle.textContent = 'Confirmer mon adresse';
      if (etat) etat.textContent = 'Ça n’a pas pu partir. Réessaie dans un instant, ou écris à contact@carclan.fr.';
    }
  });
}
