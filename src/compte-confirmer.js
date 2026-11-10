// La page du lien de confirmation d'adresse à l'inscription dans l'app
// (EDGE-10). Elle ne confirme rien en s'ouvrant : une messagerie ou un
// antivirus qui ouvre les liens avant la personne brûlerait ce lien à usage
// unique, et elle verrait « lien expiré ». Seul le bouton envoie le jeton.
import './tokens.css';
import './legal.css';
import { mountIcons } from './icons.js';
import { jetonDuLien, verifier, MESSAGES } from './compte-jeton.js';

mountIcons();

const jeton = jetonDuLien(location.search);
const bouton = document.querySelector('[data-confirmer]');
const libelle = bouton?.querySelector('[data-libelle]');
const titre = document.querySelector('[data-titre]');
const chapeau = document.querySelector('[data-chapeau]');
const etat = document.querySelector('[data-etat]');

// Le jeton n'a plus rien à faire dans la barre d'adresse une fois lu.
if (location.search) history.replaceState(null, '', location.pathname);

const finir = (t, c) => {
  if (titre) titre.textContent = t;
  if (chapeau) chapeau.textContent = c;
  if (etat) etat.textContent = '';
  bouton?.remove();
  titre?.focus();
};

if (!jeton) {
  finir(...MESSAGES.mort);
} else {
  bouton?.addEventListener('click', async () => {
    bouton.disabled = true;
    if (libelle) libelle.textContent = 'Un instant…';
    const rendu = await verifier(jeton);
    if (rendu === 'confirme') {
      finir('Votre adresse est confirmée.', 'Vous pouvez revenir dans l’app et vous connecter.');
    } else if (rendu === 'mort') {
      finir(...MESSAGES.mort);
    } else {
      bouton.disabled = false;
      if (libelle) libelle.textContent = 'Confirmer mon adresse';
      if (etat) etat.textContent = 'Ça n’a pas pu partir. Réessayez dans un instant, ou écrivez à contact@carclan.fr.';
    }
  });
}
