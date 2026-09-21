// Les pages légales : les styles, les icônes, et un sommaire qui suit la
// lecture. Rien d'autre. Pas de scène, pas d'apparition : ces pages se
// lisent, et tout ce qui bouge gêne.
import './tokens.css';
import './legal.css';
import { mountIcons } from './icons.js';

mountIcons();

// Le sommaire marque la section lue. Sans JavaScript, il reste une liste de
// liens qui fonctionne, ce qui suffit.
const liens = new Map();
for (const a of document.querySelectorAll('.sommaire a[href^="#"]')) {
  const cible = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
  if (cible) liens.set(cible, a);
}

if (liens.size && 'IntersectionObserver' in window) {
  let courant = null;
  const marquer = (a) => {
    if (courant === a) return;
    if (courant) courant.removeAttribute('aria-current');
    if (a) a.setAttribute('aria-current', 'true');
    courant = a;
  };

  const vues = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) vues.add(e.target);
      else vues.delete(e.target);
    }
    // La plus haute des sections visibles : c'est celle qu'on lit.
    let haute = null;
    for (const s of vues) {
      if (!haute || s.getBoundingClientRect().top < haute.getBoundingClientRect().top) haute = s;
    }
    marquer(haute ? liens.get(haute) : null);
  }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

  for (const section of liens.keys()) io.observe(section);
}
