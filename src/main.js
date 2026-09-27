// L'accueil de carclan.fr. Le HTML se suffit : tout ce qui suit est un
// supplément, jamais une condition pour lire la page ou s'inscrire.
import './tokens.css';
import './site.css';
import { mountIcons } from './icons.js';
import { setupWaitlist, setupCompteur } from './waitlist.js';

// Le module a tourné : le filet de index.html (qui retire `js` au bout de
// 3 s sans ce signal) n'a plus à intervenir.
window.__carclan = true;

mountIcons();

const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const large = matchMedia('(min-width: 961px)');
const pointeurFin = matchMedia('(hover: hover) and (pointer: fine)');

// ---- Les deux formulaires ----------------------------------------------------

document.querySelectorAll('[data-formulaire]').forEach((f) => setupWaitlist(f));

// Le compteur d'inscrits n'est pas branché : il ne s'affiche qu'au-delà de
// 50 inscrits (SEUIL_COMPTEUR), et l'interroger ferait sortir une requête
// vers Supabase que la page /cookies/ ne liste pas. Le jour où il devient un
// argument : rappeler setupCompteur(document.getElementById('compteur-attente'))
// ici, et ajouter ce cas à « Les seules requêtes qui sortent ».
void setupCompteur;

// Une inscription ferme l'autre formulaire aussi : on ne redemande pas en bas
// une adresse qu'on vient de donner en haut.
let inscrit = false;
// L'autre bloc ne recopie QUE le titre : le détail porte l'adresse, et un
// téléphone qui passe de main en main ne doit pas montrer celle du précédent.
document.addEventListener('attente:fait', (e) => {
  inscrit = true;
  document.querySelectorAll('[data-fait-actions]').forEach((a) => { a.hidden = false; });
  const source = e.detail?.bloc;
  const titre = source?.querySelector('[data-fait-titre]')?.textContent;
  document.querySelectorAll('[data-attente]').forEach((bloc) => {
    if (bloc === source) return;
    bloc.classList.add('done');
    bloc.querySelector('.attente')?.classList.add('done');
    const fait = bloc.querySelector('.fait');
    if (fait) {
      const t = fait.querySelector('[data-fait-titre]');
      if (t && titre) t.textContent = titre;
      fait.hidden = false;
    }
    const etat = bloc.querySelector('.etat-envoi');
    if (etat) { etat.textContent = ''; etat.classList.remove('erreur'); }
  });
  majPouce();
});

// Après une inscription : le téléphone passe de main en main sur un rasso, donc
// « Inscrire quelqu'un d'autre » rouvre le formulaire, vide, prêt.
// Tous les blocs se rouvrent : aucun ne garde l'adresse de la personne
// précédente, et le focus va au champ du bloc touché.
document.querySelectorAll('[data-autre]').forEach((b) => b.addEventListener('click', () => {
  const touche = b.closest('[data-attente]');
  document.querySelectorAll('[data-attente]').forEach((bloc) => {
    bloc.classList.remove('done');
    bloc.querySelector('.attente')?.classList.remove('done');
    const fait = bloc.querySelector('.fait');
    if (fait) fait.hidden = true;
    const actions = bloc.querySelector('[data-fait-actions]');
    if (actions) actions.hidden = true;
    const etat = bloc.querySelector('.etat-envoi');
    if (etat) { etat.textContent = ''; etat.classList.remove('erreur'); }
    const champ = bloc.querySelector('input[type="email"]');
    if (champ) { champ.value = ''; champ.setAttribute('aria-invalid', 'false'); }
    const bouton = bloc.querySelector('button[type="submit"]');
    if (bouton) {
      bouton.disabled = false;
      const l = bouton.querySelector('[data-libelle]');
      if (l) l.textContent = 'Me prévenir';
    }
  });
  inscrit = false;
  majPouce();
  touche?.querySelector('input[type="email"]')?.focus();
}));

document.querySelectorAll('[data-partager]').forEach((b) => b.addEventListener('click', async () => {
  const donnees = { title: 'CarClan', text: 'Tous les rassos près de chez vous, sur une carte. L’app sort cet hiver.', url: 'https://carclan.fr' };
  b.dataset.libelle ??= b.textContent;
  try {
    if (navigator.share) { await navigator.share(donnees); return; }
    await navigator.clipboard.writeText(donnees.url);
    b.textContent = 'Lien copié';
    const etat = b.closest('[data-attente]')?.querySelector('.etat-envoi');
    if (etat) etat.textContent = 'Le lien carclan.fr est copié.';
    setTimeout(() => { b.textContent = b.dataset.libelle; }, 2000);
  } catch {
    // Partage annulé : rien à dire.
  }
}));

// ---- La barre ---------------------------------------------------------------------

const barre = document.querySelector('[data-barre]');
const surScroll = () => barre?.classList.toggle('on', window.scrollY > 24);
window.addEventListener('scroll', surScroll, { passive: true });
surScroll();

// ---- Le menu du téléphone ---------------------------------------------------------

const menu = document.getElementById('menu');
const ouvreMenu = document.querySelector('[data-ouvre-menu]');
if (menu && ouvreMenu && typeof menu.showModal === 'function') {
  ouvreMenu.addEventListener('click', () => {
    menu.showModal();
    ouvreMenu.setAttribute('aria-expanded', 'true');
  });
  menu.addEventListener('close', () => ouvreMenu.setAttribute('aria-expanded', 'false'));
  // Un lien du menu ferme le menu PUIS laisse le navigateur aller à l'ancre :
  // la page derrière n'est plus inerte au moment où elle défile.
  menu.querySelectorAll('[data-ferme-menu]').forEach((el) => el.addEventListener('click', () => menu.close()));
  menu.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });
} else if (ouvreMenu) {
  // Sans <dialog> modal : le bouton mène au pied de page, qui porte tous les liens.
  ouvreMenu.addEventListener('click', () => document.querySelector('.pied')?.scrollIntoView());
}

// ---- Le QR code ----------------------------------------------------------------------

const qr = document.getElementById('qr');
if (qr && typeof qr.showModal === 'function') {
  const ouvrirQr = () => { if (!qr.open) { if (menu?.open) menu.close(); qr.showModal(); } };
  document.querySelectorAll('[data-ouvre-qr]').forEach((b) => b.addEventListener('click', ouvrirQr));
  qr.querySelector('[data-ferme-qr]')?.addEventListener('click', () => qr.close());
  // Pas de fermeture en touchant le fond : sur un rasso, le téléphone passe de
  // main en main et un doigt à côté du code ne doit pas le faire disparaître.
  qr.addEventListener('close', () => { if (location.hash === '#qr') history.replaceState(null, '', location.pathname + location.search); });
  const surHash = () => { if (location.hash === '#qr') ouvrirQr(); };
  window.addEventListener('hashchange', surHash);
  surHash();
} else {
  document.querySelectorAll('[data-ouvre-qr]').forEach((b) => { b.hidden = true; });
}

// « Être prévenu » : on descend au formulaire du bas, et sur un ordinateur le
// champ prend le focus une fois arrivé. Sur un téléphone, on n'ouvre pas le
// clavier sans qu'on l'ait demandé.
document.querySelectorAll('[data-vers-liste]').forEach((a) => {
  a.addEventListener('click', () => {
    if (!pointeurFin.matches || inscrit) return;
    setTimeout(() => document.getElementById('email-bas')?.focus({ preventScroll: true }), reduit ? 0 : 700);
  });
});

// ---- Les apparitions ----------------------------------------------------------------

const apparaitre = document.querySelectorAll('[data-apparait]');
if (!reduit && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
  apparaitre.forEach((el) => io.observe(el));
} else {
  apparaitre.forEach((el) => el.classList.add('in'));
}

// ---- Le balayage de lumière ---------------------------------------------------------

function balayer(vitre) {
  if (!vitre || reduit) return;
  vitre.classList.remove('balaye');
  void vitre.offsetWidth; // relance l'animation même si elle vient de jouer
  vitre.classList.add('balaye');
}

// Le téléphone du premier écran reçoit son passage de lampe une fois monté.
const vitreOuverture = document.querySelector('.tel-ouverture .tel-vitre');
setTimeout(() => balayer(vitreOuverture), 1500);

// ---- La visite ------------------------------------------------------------------------
// Sur un écran large, le téléphone est collant et change d'écran avec le
// chapitre lu. Sur un téléphone, chaque chapitre a son écran, et le passage de
// lampe joue quand il entre dans la vue.

const chapitres = [...document.querySelectorAll('[data-chapitre]')];
const rail = [...document.querySelectorAll('[data-rail] li')];
const vitreVisite = document.querySelector('[data-vitre]');
const ecrans = vitreVisite ? [...vitreVisite.querySelectorAll('[data-ecran]')] : [];
let courant = 0;

function activer(i) {
  if (i < 0 || (i === courant && chapitres[i]?.classList.contains('actif'))) return;
  courant = i;
  chapitres.forEach((c, j) => c.classList.toggle('actif', j === i));
  rail.forEach((li, j) => li.classList.toggle('actif', j === i));
  const cle = chapitres[i]?.dataset.chapitre;
  ecrans.forEach((img) => img.classList.toggle('actif', img.dataset.ecran === cle));
  balayer(vitreVisite);
}

if (chapitres.length && 'IntersectionObserver' in window) {
  // Les écrans de la visite se chargent tous dès qu'on approche de la
  // section, pour qu'aucun ne clignote en arrivant.
  const visite = document.getElementById('application');
  // Seulement sur un écran large : sur un téléphone, ce téléphone collant
  // est masqué et chaque chapitre porte sa propre image, chargée à la demande.
  const precharge = new IntersectionObserver((entrees) => {
    if (large.matches && entrees.some((e) => e.isIntersecting)) {
      ecrans.forEach((img) => { img.loading = 'eager'; });
      precharge.disconnect();
    }
  }, { rootMargin: '800px 0px' });
  if (visite) precharge.observe(visite);

  const lecture = new IntersectionObserver((entrees) => {
    if (!large.matches) return;
    for (const e of entrees) {
      if (e.isIntersecting) activer(chapitres.indexOf(e.target));
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  chapitres.forEach((c) => lecture.observe(c));
  chapitres[0].classList.add('actif');

  const vitresMobiles = document.querySelectorAll('.tel-chapitre .tel-vitre');
  const entree = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (e.isIntersecting) { balayer(e.target); entree.unobserve(e.target); }
    }
  }, { threshold: 0.55 });
  vitresMobiles.forEach((v) => entree.observe(v));
} else {
  chapitres.forEach((c) => c.classList.add('actif'));
}

// ---- Le bouton « Je participe » -------------------------------------------------------
// Les mêmes états que l'application : ambre pendant l'envoi, « Vous y allez »
// avec la coche tracée et une vibration franche, tenu 1,6 s, puis « Inviter
// des amis ». Un nouveau toucher recommence.

const participe = document.querySelector('[data-participe]');
if (participe) {
  const note = document.querySelector('[data-note-participe]');
  const noteRepos = note?.textContent || '';
  const COCHE = '<svg class="coche-tracee" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.6 10.4 8.4 15.2 16.8 5.6" /></svg>';
  const ETATS = {
    repos: { html: '<svg class="ic" aria-hidden="true"><use href="#cc-check" /></svg>Je participe', classe: null, note: noteRepos },
    engage: { html: `${COCHE}Vous y allez`, classe: 'engage', note: 'Dans l’application, c’est fait : vos amis le voient.' },
    inviter: { html: '<svg class="ic" aria-hidden="true"><use href="#cc-amis" /></svg>Inviter des amis', classe: 'inviter', note: 'Touchez encore pour recommencer.' },
  };
  let etat = 'repos';
  let minuteurs = [];
  // Le libellé est recréé à chaque état, pour que son entrée rejoue.
  const poser = (cle, envoi = false) => {
    const e = ETATS[cle];
    participe.classList.remove('envoi', 'engage', 'inviter');
    if (e.classe) participe.classList.add(e.classe);
    if (envoi) participe.classList.add('envoi');
    const span = document.createElement('span');
    span.className = 'participe-libelle';
    span.innerHTML = envoi ? participe.querySelector('.participe-libelle').innerHTML : e.html;
    participe.replaceChildren(span);
    if (note && !envoi) note.textContent = e.note;
  };
  participe.addEventListener('click', () => {
    minuteurs.forEach(clearTimeout);
    minuteurs = [];
    if (etat !== 'repos') { etat = 'repos'; poser('repos'); return; }
    etat = 'envoi';
    poser('repos', true);
    minuteurs.push(setTimeout(() => {
      etat = 'engage';
      poser('engage');
      try { navigator.vibrate?.(24); } catch { /* pas de vibreur */ }
      minuteurs.push(setTimeout(() => { etat = 'inviter'; poser('inviter'); }, 1600));
    }, reduit ? 0 : 420));
  });
}

// ---- Les repères de la ville --------------------------------------------------------
// Positions en pourcentage de chaque image, calculées par la carte elle-même
// au moment du rendu (map.project), pas placées à l'œil. `d` : l'image large,
// `p` : l'image portrait.

const REPERES = [
  { lieu: 'Tourcoing', quand: 'En direct', type: 'Rasso', direct: true, d: [69.93, 17.51], p: [51.67, 73.61], court: true },
  { lieu: 'Wattrelos', quand: 'Sam. 20 h', type: 'Expo', gauche: true, d: [88.04, 36.36], p: [null, null] },
  { lieu: 'Villeneuve-d’Ascq', quand: 'Dim. 9 h', type: 'Balade', d: [39.6, 88.29], p: [null, null] },
  { lieu: 'Roubaix', quand: 'Ven. 21 h', type: 'Club', gauche: true, d: [null, null], p: [null, null] },
];

// La région : les villes où la carte se remplit d'abord, Tourcoing en ambre.
const REGION = [
  { lieu: 'Tourcoing', origine: true, d: [61.86, 33.89] },
  { lieu: 'Lille', gauche: true, d: [59.47, 39.37] },
  { lieu: 'Courtrai', d: [64.56, 27.18] },
  { lieu: 'Tournai', d: [67.63, 41.33] },
  { lieu: 'Dunkerque', d: [42.1, 13.91] },
  { lieu: 'Calais', d: [28.83, 19.14] },
  { lieu: 'Valenciennes', d: [71.07, 57.12] },
];

function poser(liste, cible, portrait) {
  if (!cible) return;
  cible.textContent = '';
  liste.forEach((r, i) => {
    const [x, y] = portrait ? r.p : r.d;
    if (x == null || y == null) return;
    const li = document.createElement('li');
    li.className = `repere${r.direct ? ' direct' : ''}${r.gauche ? ' gauche' : ''}${r.origine ? ' origine' : ''}`;
    li.style.setProperty('--x', `${x}%`);
    li.style.setProperty('--y', `${y}%`);
    li.style.setProperty('--i', String(i));
    const point = document.createElement('span');
    point.className = 'repere-point';
    const legende = document.createElement('span');
    legende.className = 'repere-legende t-donnee';
    if (r.quand) {
      // Debout, la légende est courte : la bande de ville est étroite.
      const b = document.createElement('b');
      b.textContent = portrait && r.court ? `${r.quand} · ` : `${r.quand} · ${r.type} · `;
      legende.append(b);
    }
    legende.append(r.lieu);
    li.append(point, legende);
    cible.appendChild(li);
  });
}

const ouverture = document.querySelector('.ouverture');
if (ouverture && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => ouverture.classList.toggle('hors-vue', !e.isIntersecting)).observe(ouverture);
}

const portrait = matchMedia('(max-aspect-ratio: 4/5)');
// Debout, la ville est 40 % plus grande que l'écran : on la décale pour
// que le rasso en direct tombe au milieu de la bande de ville visible entre
// le formulaire et le téléphone. Sans décalage possible, le repère reste où
// il est et le masquage ci-dessous décide s'il se montre.
const ville = document.querySelector('.ville');
function caler() {
  if (!ville) return;
  if (!portrait.matches) { ville.style.removeProperty('--dy'); return; }
  const plan = ville.querySelector('.ville-plan');
  const texte = (document.querySelector('.exemple-mobile') || document.querySelector('.attente-ouverture'))?.getBoundingClientRect();
  const tel = document.querySelector('.tel-ouverture .tel-coque')?.getBoundingClientRect();
  if (!plan || !texte || !tel) return;
  const cadre = ville.getBoundingClientRect();
  const H = plan.offsetHeight;
  const direct = REPERES.find((r) => r.direct);
  const cible = (texte.bottom + tel.top) / 2 - cadre.top;
  const dy = Math.max(cadre.height - H, Math.min(0, cible - (direct.p[1] / 100) * H));
  ville.style.setProperty('--dy', `${Math.round(dy)}px`);
}

// Un repère qui toucherait un texte, le téléphone ou le bord n'est pas montré.
function masquer(liste, obstacles) {
  if (!liste) return;
  const rects = obstacles.map((o) => o.getBoundingClientRect()).filter((r) => r.width && r.height);
  liste.querySelectorAll('.repere').forEach((li) => {
    const a = li.querySelector('.repere-legende').getBoundingClientRect();
    const b = li.querySelector('.repere-point').getBoundingClientRect();
    const boite = { l: Math.min(a.left, b.left) - 8, r: Math.max(a.right, b.right) + 8, t: Math.min(a.top, b.top) - 8, b: Math.max(a.bottom, b.bottom) + 8 };
    const touche = rects.some((r) => !(boite.r < r.left || boite.l > r.right || boite.b < r.top || boite.t > r.bottom));
    const dehors = boite.l < 0 || boite.r > document.documentElement.clientWidth;
    li.classList.toggle('masque', touche || dehors);
  });
}

const obstaclesHaut = () => [...document.querySelectorAll('.ouverture h1, .ouverture .chapeau, .attente-ouverture, .exemple-mobile, .tel-ouverture .tel-coque, .ouverture-mention')];
const obstaclesRegion = () => [...document.querySelectorAll('.territoire-texte h2, .territoire-texte p')];

const poserTout = () => {
  poser(REPERES, document.querySelector('[data-reperes]'), portrait.matches);
  poser(REGION, document.querySelector('[data-reperes-region]'), false);
  caler();
  requestAnimationFrame(() => {
    masquer(document.querySelector('[data-reperes]'), obstaclesHaut());
    masquer(document.querySelector('[data-reperes-region]'), obstaclesRegion());
  });
};
poserTout();
portrait.addEventListener?.('change', poserTout);
window.addEventListener('resize', () => requestAnimationFrame(poserTout), { passive: true });
document.fonts?.ready.then(poserTout);
// Après les apparitions du premier écran et la pose de la ville.
setTimeout(poserTout, 1300);
setTimeout(poserTout, reduit ? 0 : 9200);

// ---- Le tableau des départs ------------------------------------------------------
// Sur un écran large, l'affiche du type survolé s'allume en grand à côté.

const depart = document.querySelector('[data-depart]');
const vedettes = [...document.querySelectorAll('[data-vedette]')];
if (depart && vedettes.length) {
  const lignes = [...depart.querySelectorAll('.depart-ligne')];
  const choisir = (ligne) => {
    const cle = ligne.dataset.type;
    lignes.forEach((l) => l.classList.toggle('actif', l === ligne));
    vedettes.forEach((v) => v.classList.toggle('actif', v.dataset.vedette === cle));
  };
  lignes.forEach((l) => l.addEventListener('mouseenter', () => { if (pointeurFin.matches) choisir(l); }));
}

// ---- Le pouce -------------------------------------------------------------------------
// Visible sur téléphone entre les deux formulaires, jamais par-dessus l'un d'eux.

const pouce = document.querySelector('[data-pouce]');
const formHaut = document.querySelector('.attente-ouverture');
const formBas = document.getElementById('liste');
const vus = new Set(['haut']);

function majPouce() {
  if (!pouce) return;
  const montrer = !inscrit && !vus.has('haut') && !vus.has('bas');
  pouce.classList.toggle('visible', montrer);
  pouce.setAttribute('aria-hidden', montrer ? 'false' : 'true');
  pouce.tabIndex = montrer ? 0 : -1;
}

if (pouce && formHaut && formBas && 'IntersectionObserver' in window) {
  pouce.hidden = false;
  majPouce();
  const io = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      const cle = e.target === formHaut ? 'haut' : 'bas';
      if (e.isIntersecting) vus.add(cle); else vus.delete(cle);
    }
    majPouce();
  });
  io.observe(formHaut);
  io.observe(formBas);
}
