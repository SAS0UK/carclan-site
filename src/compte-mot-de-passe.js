// La page du lien « mot de passe oublié » de l'app (EDGE-10). Elle ne consomme
// rien : le bouton ouvre l'app en lui passant le jeton, et c'est l'app qui le
// présente à Supabase. Ouvrir la page (ou la faire ouvrir par un antivirus de
// messagerie) ne brûle donc pas le lien.
import './tokens.css';
import './legal.css';
import { mountIcons } from './icons.js';
import { jetonDuLien, lienApp } from './compte-jeton.js';

mountIcons();

const jeton = jetonDuLien(location.search);
const bouton = document.querySelector('[data-ouvrir]');
const titre = document.querySelector('[data-titre]');
const chapeau = document.querySelector('[data-chapeau]');
const etat = document.querySelector('[data-etat]');

if (location.search) history.replaceState(null, '', location.pathname);

if (!jeton) {
  if (titre) titre.textContent = 'Ce lien ne marche plus.';
  if (chapeau) chapeau.textContent = 'Il a été mal copié. Dans l’app CarClan, touchez « Mot de passe oublié » pour recevoir un nouveau message.';
  bouton?.remove();
  if (etat) etat.textContent = '';
  titre?.focus();
} else {
  bouton?.addEventListener('click', () => {
    if (etat) etat.textContent = 'Si CarClan ne s’ouvre pas, ouvrez ce message sur le téléphone où l’app est installée.';
    location.href = lienApp(jeton);
  });
}
