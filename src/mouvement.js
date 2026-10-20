// Le mouvement de l'accueil, demandé par Mathys le 20 octobre 2026 : les
// phares qui roulent sur la carte du haut « comme sur le téléphone », le
// téléphone du haut qui se range quand on descend, et les appareils plus bas
// qui pivotent.
//
// Une seule boucle requestAnimationFrame pour tout. Elle ne tourne que s'il y
// a quelque chose à faire : la carte du haut à l'écran, un défilement, un
// survol qui n'a pas fini de se poser. Onglet caché ou carte hors de l'écran,
// elle s'arrête. Que des transformations et des opacités, jamais une
// propriété qui redessine la page. Et rien du tout si l'on a demandé moins
// d'animations : la page est la même, immobile.

// Les tracés des voies (6 Ko compressés) arrivent à part, après la page :
// ils ne retardent ni le premier affichage ni le formulaire, et les phares
// ne se lèvent qu'à 1,6 s.
let VOIES = null;

const moins = matchMedia('(prefers-reduced-motion: reduce)');
const large = matchMedia('(min-width: 961px)');
const portrait = matchMedia('(max-aspect-ratio: 4/5)');
const pointeurFin = matchMedia('(hover: hover) and (pointer: fine)');

const borne = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lisse = (a, b, x) => { const t = borne((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const debut = performance.now();
// L'instant où la circulation commence à se lever, depuis `debut` : 1,6 s,
// ou plus tard si la page a mis plus longtemps à charger.
let departPhares = 1600;

// ---- Les phares ---------------------------------------------------------------------
// Les mêmes que sur la carte de l'app (phares_autoroutes.dart, réglés avec
// Mathys le 7 octobre 2026 : « peu nombreuses et lentes ») : de petites
// lumières craie qui roulent le long des grands axes, sans les bretelles, une
// tous les 200 points, à 10 points par seconde quel que soit l'écran.
//
// Un écart avec l'app, voulu : elles roulent aussi sur les voies rapides
// (la VRU, la rocade), pas seulement sur les autoroutes. Sur un téléphone,
// l'A22 passe tout entière sous le texte ; sans les voies rapides, la bande
// de carte visible entre le formulaire et le téléphone n'aurait aucune
// lumière (mesuré le 20 octobre 2026).
//
// Et un emprunt à l'écran d'accueil de l'app (_horsLecture) : une lumière
// s'efface en approchant d'un texte. Le titre et le formulaire restent
// écrits sur de la nuit immobile.

const PHARES = {
  vitesse: 10, // points par seconde (vitessePhares)
  espacement: 200, // points entre deux lumières d'une même voie (espacementPhares)
  coeur: 1.4, // rayon du cœur, craie pleine (pinceauxDesPhares)
  halo: 3.2, // rayon du halo, craie à 34 % (AppOpacities.soft)…
  flou: 3, // … flouté d'autant (MaskFilter.blur, écart type en points)
  alphaHalo: 0.34,
  fonduBout: 12, // elles s'éteignent sur 12 points au bout d'une autoroute qui s'arrête (_fonduDeBout)
  cadence: 1000 / 30, // trente images par seconde, comme l'app : à 10 points par seconde, l'œil n'en voit pas plus
  // Le départ, dans la chorégraphie du premier écran : les lampes de la
  // ville chauffent pendant 2,6 s (@keyframes chauffe), la circulation
  // s'y lève à partir de 1,6 s, voie après voie, chacune en 600 ms.
  naissance: 1600, // au plus tôt ; plus tard si la page charge plus lentement (departPhares)
  decalage: 700,
  fondu: 600,
  // La marge de lecture : éteinte à 4 points d'un texte, pleine à 28.
  lectureProche: 4,
  lectureLoin: 28,
};

// Ce qui se lit sur la carte du haut : une lumière n'y passe pas.
const LECTURE = '.ouverture h1 .ligne, .ouverture .chapeau, .attente-ouverture, .exemple-mobile, .ouverture-mention, [data-barre]';

// Le halo d'un phare : un disque de rayon `halo` flouté par une gaussienne,
// comme le MaskFilter de l'app. Calculé une fois, point par point, plutôt
// qu'approché par un dégradé choisi à l'œil.
function profilHalo() {
  const { halo: a, flou: s } = PHARES;
  const pas = 0.2;
  const disque = [];
  for (let x = -a; x <= a; x += pas) for (let y = -a; y <= a; y += pas) if (x * x + y * y <= a * a) disque.push([x, y]);
  const norme = (pas * pas) / (2 * Math.PI * s * s);
  const table = [];
  for (let r = 0; r <= a + 3 * s; r += 0.1) {
    let somme = 0;
    for (const [x, y] of disque) somme += Math.exp(-((r - x) ** 2 + y * y) / (2 * s * s));
    table.push(somme * norme);
  }
  return (r) => table[Math.min(table.length - 1, Math.round(r / 0.1))] || 0;
}

let profil = null;

function faireSprite(dpr) {
  profil ??= profilHalo();
  const rayon = PHARES.halo + 2.2 * PHARES.flou; // au-delà, le halo est sous 1 %
  const n = Math.ceil(rayon * 2 * dpr) + 2;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  const centre = n / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - centre, y + 0.5 - centre) / dpr;
      const i = (y * n + x) * 4;
      img.data[i] = 243; img.data[i + 1] = 239; img.data[i + 2] = 232; // craie #f3efe8
      img.data[i + 3] = Math.round(255 * PHARES.alphaHalo * profil(r));
    }
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#f3efe8';
  g.beginPath();
  g.arc(centre, centre, PHARES.coeur * dpr, 0, Math.PI * 2);
  g.fill();
  return c;
}

// Une voie, en points CSS de la carte affichée : ses points, la longueur
// parcourue à chacun, et sa phase (deux chaussées ne roulent pas en rang).
function preparer(pts, w, h, i) {
  const x = [], y = [], cumul = [0];
  for (let k = 0; k < pts.length; k += 2) {
    x.push((pts[k] / 1e4) * w);
    y.push((pts[k + 1] / 1e4) * h);
    if (k) cumul.push(cumul[cumul.length - 1] + Math.hypot(x[x.length - 1] - x[x.length - 2], y[y.length - 1] - y[y.length - 2]));
  }
  const nombreDOr = 0.6180339887;
  return {
    x, y, cumul,
    longueur: cumul[cumul.length - 1],
    phase: ((i * nombreDOr) % 1) * PHARES.espacement,
    naitA: departPhares + ((i * 0.37) % 1) * PHARES.decalage,
  };
}

function pointA(v, s) {
  let a = 0, b = v.cumul.length - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (v.cumul[m] <= s) a = m; else b = m; }
  const t = (s - v.cumul[a]) / (v.cumul[b] - v.cumul[a] || 1);
  return [v.x[a] + (v.x[b] - v.x[a]) * t, v.y[a] + (v.y[b] - v.y[a]) * t];
}

const ouverture = document.querySelector('.ouverture');
const plan = document.querySelector('.ouverture .ville-plan');
let canvas = null, ctx = null, sprite = null, dpr = 1, voies = [], traces = [];
let tRoule = 0, derniereImagePhares = 0, villeVisible = true;

function dimensionner() {
  if (!canvas) return;
  const w = plan.offsetWidth, h = plan.offsetHeight;
  if (!w || !h) return;
  const d = Math.min(2, window.devicePixelRatio || 1);
  const jeu = portrait.matches ? VOIES.p : VOIES.d;
  if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d) || d !== dpr || canvas.dataset.jeu !== (jeu === VOIES.p ? 'p' : 'd')) {
    dpr = d;
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    canvas.dataset.jeu = jeu === VOIES.p ? 'p' : 'd';
    sprite = faireSprite(d);
    traces = [];
  }
  voies = jeu.map((pts, i) => preparer(pts, w, h, i));
  derniereImagePhares = 0;
}

// La distance d'un point de la fenêtre au texte le plus proche, en points.
function distanceLecture(vx, vy, zones) {
  let d = Infinity;
  for (const r of zones) {
    const dx = Math.max(r.left - vx, 0, vx - r.right);
    const dy = Math.max(r.top - vy, 0, vy - r.bottom);
    d = Math.min(d, Math.hypot(dx, dy));
  }
  return d;
}

function dessinerPhares(maintenant) {
  for (const r of traces) ctx.clearRect(r[0], r[1], r[2], r[3]);
  traces = [];
  const ecoule = maintenant - debut;
  const taille = sprite.width;
  const { espacement, fonduBout, fondu, lectureProche, lectureLoin } = PHARES;
  // Où la toile tombe dans la fenêtre à cet instant (la ville se pose et
  // plonge au défilement), et où sont les textes : lus avant toute écriture.
  const cadre = canvas.getBoundingClientRect();
  const k = cadre.width / (canvas.offsetWidth || 1);
  const zones = [];
  for (const el of document.querySelectorAll(LECTURE)) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height) zones.push(r);
  }
  for (const v of voies) {
    const naissance = lisse(v.naitA, v.naitA + fondu, ecoule);
    if (naissance <= 0) continue;
    // Toutes les lumières d'une voie avancent ensemble : leur place est la
    // phase de la voie, plus le chemin parcouru, plus un espacement par
    // lumière. Rien n'est tiré au hasard, rien ne saute.
    for (let s = (v.phase + tRoule * PHARES.vitesse) % espacement; s < v.longueur; s += espacement) {
      let eclat = naissance * Math.min(1, s / fonduBout, (v.longueur - s) / fonduBout);
      if (eclat <= 0.01) continue;
      const [x, y] = pointA(v, s);
      const gx = x * dpr - taille / 2, gy = y * dpr - taille / 2;
      if (gx < -taille || gy < -taille || gx > canvas.width || gy > canvas.height) continue;
      const vx = cadre.left + x * k, vy = cadre.top + y * k;
      if (vx < -20 || vy < -20 || vx > innerWidth + 20 || vy > innerHeight + 20) continue;
      eclat *= lisse(lectureProche, lectureLoin, distanceLecture(vx, vy, zones));
      if (eclat <= 0.01) continue;
      ctx.globalAlpha = eclat;
      ctx.drawImage(sprite, gx, gy);
      traces.push([Math.floor(gx) - 1, Math.floor(gy) - 1, taille + 3, taille + 3]);
    }
  }
  ctx.globalAlpha = 1;
}

function pharesActifs() {
  return canvas && villeVisible && !document.hidden;
}

// ---- Le téléphone du haut ------------------------------------------------------------
// Il entre par le CSS (@keyframes telLeve, site.css). Au défilement, il se
// range : il glisse vers le bas en basculant en arrière, comme un téléphone
// qu'on glisse dans sa poche, et s'efface. Le bord bas du premier écran est
// la poche. Tout dépend du défilement seul : en remontant, il ressort.

const coqueHaut = document.querySelector('.tel-ouverture .tel-coque');
let hauteurOuverture = 0, hauteurCoque = 0;

function majRangement() {
  if (!coqueHaut) return;
  const p = borne(window.scrollY / (hauteurOuverture * 0.5 || 1));
  const e = p * p * (3 - 2 * p);
  if (e === 0) {
    coqueHaut.style.transform = '';
    coqueHaut.style.opacity = '';
    coqueHaut.style.removeProperty('--range');
    return;
  }
  coqueHaut.style.transform = `perspective(1100px) translateY(${(e * 0.38 * hauteurCoque).toFixed(1)}px) rotateX(${(e * 24).toFixed(2)}deg) rotateZ(${(e * -5).toFixed(2)}deg) scale(${(1 - 0.05 * e).toFixed(4)})`;
  // Il s'efface à partir du tiers du geste : quand il s'enfonce sous le bord
  // du premier écran, il est déjà à moitié parti.
  coqueHaut.style.opacity = (1 - lisse(0.3, 0.9, p)).toFixed(3);
  coqueHaut.style.setProperty('--range', e.toFixed(3));
}

// ---- Les pivots ----------------------------------------------------------------------
// Les téléphones de la visite et les appareils de « Et sur tous tes écrans »
// pivotent selon leur place dans la fenêtre : tournés de côté en arrivant
// par le bas, bien de face au milieu, tournés de l'autre côté en partant par
// le haut, comme un téléphone qu'on fait tourner dans la main. Au milieu de
// l'écran, là où on lit, l'angle est presque nul. À la souris, ils
// s'inclinent en plus vers le pointeur, avec un peu d'inertie.

// Amplitudes en degrés : rotation (Y, le pivot qu'on voit), basculement
// (X, plus discret), et perspective en px. Les angles pleins ne se voient
// qu'aux bords de la fenêtre ; au milieu, moins de 3 degrés.
const GENRES = {
  chapitre: { ax: 7, ay: 18, persp: 1000 },
  tablette: { ax: 5, ay: 10, persp: 1600 },
  pliable: { ax: 5, ay: 12, persp: 1400 },
  montres: { ax: 6, ay: 14, persp: 1100 },
};

const pivots = [];
function ajouterPivot(el, mesure, genre) {
  if (el && mesure) pivots.push({ el, mesure, genre, hx: 0, hy: 0, cx: 0, cy: 0, visible: false });
}
document.querySelectorAll('.tel-chapitre').forEach((f) => ajouterPivot(f.querySelector('.tel-coque'), f, 'chapitre'));
ajouterPivot(document.querySelector('.appareil .tablette'), document.querySelector('.appareil-tablette'), 'tablette');
ajouterPivot(document.querySelector('.appareil .pliable'), document.querySelector('.appareil-pliable'), 'pliable');
ajouterPivot(document.querySelector('.appareil .montres'), document.querySelector('.appareil-montres'), 'montres');
// Le téléphone collant de la visite, sur un écran large : il pivote au fil
// des cinq chapitres, et arrive tourné, comme pris en main.
const corpsVisite = document.querySelector('.visite-corps');
const visite = { el: document.querySelector('.tel-visite .tel-coque'), mesure: document.querySelector('.visite-scene'), genre: 'visite', hx: 0, hy: 0, cx: 0, cy: 0, visible: false };

function poserPivot(p, vh) {
  if (p.genre === 'visite') {
    if (!large.matches || !corpsVisite) { p.el.style.transform = ''; return; }
    const r = corpsVisite.getBoundingClientRect();
    const arrivee = 1 - (1 - borne((vh - r.top) / vh)) ** 3;
    const lecture = borne(-r.top / Math.max(1, r.height - vh));
    const ry = -10 + 20 * lecture - 16 * (1 - arrivee) + p.cy;
    const rx = 3 + 9 * (1 - arrivee) + p.cx;
    p.el.style.transform = `perspective(1200px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    return;
  }
  const g = GENRES[p.genre];
  const r = p.mesure.getBoundingClientRect();
  if (!r.height) { p.el.style.transform = ''; return; }
  // De 1 (il entre par le bas) à -1 (il sort par le haut), 0 au milieu.
  const v = borne((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
  const rx = v * g.ax + p.cx;
  const ry = -v * g.ay + p.cy;
  const s = 1 - 0.035 * Math.abs(v);
  p.el.style.transform = `perspective(${g.persp}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(4)})`;
}

// Le survol : la vitre penche du côté du pointeur, comme une pression du
// doigt. 6 degrés au plus, et le retour se fait en douceur.
let survolEnCours = false;
function brancherSurvol(p) {
  const zone = p.genre === 'visite' ? p.el : p.mesure.querySelector(':scope > div');
  if (!zone) return;
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !pointeurFin.matches) return;
    const r = zone.getBoundingClientRect();
    const px = borne(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    const py = borne(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    p.hx = -py * 5;
    p.hy = px * 6;
    survolEnCours = true;
    demander();
  });
  zone.addEventListener('pointerleave', () => { p.hx = 0; p.hy = 0; survolEnCours = true; demander(); });
}

function majSurvol(dt, vh) {
  let bouge = false;
  const k = 1 - Math.exp(-dt / 140);
  for (const p of [...pivots, visite]) {
    if (!p.el) continue;
    const dx = p.hx - p.cx, dy = p.hy - p.cy;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      if (dx || dy) { p.cx = p.hx; p.cy = p.hy; poserPivot(p, vh); }
      continue;
    }
    p.cx += dx * k;
    p.cy += dy * k;
    poserPivot(p, vh);
    bouge = true;
  }
  return bouge;
}

// ---- La boucle -----------------------------------------------------------------------

let rafId = 0, precedente = 0, defile = true, actif = true;

function demander() {
  if (actif && !rafId) rafId = requestAnimationFrame(image);
}

function image(maintenant) {
  rafId = 0;
  const dt = precedente ? Math.min(100, maintenant - precedente) : 0;
  precedente = maintenant;
  let encore = false;
  const vh = window.innerHeight;

  if (pharesActifs()) {
    tRoule += dt / 1000;
    // Trente images par seconde : une sur deux à 60 Hz, une sur quatre à
    // 120 Hz. La marge de 4 ms garde le rythme quand une image arrive un
    // peu tôt.
    if (maintenant - derniereImagePhares >= PHARES.cadence - 4) {
      dessinerPhares(maintenant);
      derniereImagePhares = maintenant;
    }
    encore = true;
  }

  if (defile) {
    defile = false;
    majRangement();
    for (const p of pivots) if (p.visible) poserPivot(p, vh);
    if (visite.el && visite.visible) poserPivot(visite, vh);
  }

  if (survolEnCours) {
    survolEnCours = majSurvol(dt, vh);
    encore ||= survolEnCours;
  }

  if (encore) demander();
  else precedente = 0;
}

function mesurer() {
  hauteurOuverture = ouverture?.offsetHeight || window.innerHeight;
  hauteurCoque = coqueHaut?.offsetHeight || 0;
  dimensionner();
  defile = true;
  demander();
}

function poserToile() {
  if (!actif || !ouverture || !plan || !VOIES) return;
  departPhares = Math.max(PHARES.naissance, performance.now() - debut + 100);
  canvas = document.createElement('canvas');
  canvas.className = 'phares';
  canvas.setAttribute('aria-hidden', 'true');
  plan.append(canvas);
  ctx = canvas.getContext('2d');
  dimensionner();
  demander();
}

function demarrer() {
  // Les phares attendent la fin du chargement : ni leurs tracés ni leur
  // toile ne prennent de place au premier affichage d'un téléphone en 4G.
  const charger = () => import('./phares-voies.js').then((m) => { VOIES = m.VOIES; poserToile(); }).catch(() => { /* sans tracés, pas de phares : la carte reste telle quelle */ });
  if (ouverture && plan) {
    if (document.readyState === 'complete') charger();
    else window.addEventListener('load', charger, { once: true });
  }

  if ('IntersectionObserver' in window) {
    if (ouverture) {
      new IntersectionObserver(([e]) => { villeVisible = e.isIntersecting; demander(); }).observe(ouverture);
    }
    const io = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        const p = e.target === visite.mesure ? visite : pivots.find((x) => x.mesure === e.target);
        if (!p) continue;
        p.visible = e.isIntersecting;
      }
      defile = true;
      demander();
    }, { rootMargin: '15% 0px' });
    pivots.forEach((p) => io.observe(p.mesure));
    if (visite.el && visite.mesure) io.observe(visite.mesure);
  } else {
    pivots.forEach((p) => { p.visible = true; });
    visite.visible = true;
  }

  pivots.forEach(brancherSurvol);
  if (visite.el) brancherSurvol(visite);

  window.addEventListener('scroll', () => { defile = true; demander(); }, { passive: true });
  window.addEventListener('resize', mesurer, { passive: true });
  if ('ResizeObserver' in window && plan) new ResizeObserver(() => { dimensionner(); demander(); }).observe(plan);
  portrait.addEventListener?.('change', mesurer);
  large.addEventListener?.('change', mesurer);
  document.addEventListener('visibilitychange', () => { precedente = 0; demander(); });
  mesurer();
}

// Moins d'animations demandé en cours de route : tout se fige et reprend sa
// place, la carte sans ses phares.
function arreter() {
  actif = false;
  cancelAnimationFrame(rafId);
  rafId = 0;
  canvas?.remove();
  canvas = null;
  for (const p of [...pivots, visite]) if (p.el) p.el.style.transform = '';
  if (coqueHaut) {
    coqueHaut.style.transform = '';
    coqueHaut.style.opacity = '';
    coqueHaut.style.removeProperty('--range');
  }
}

if (!moins.matches) {
  demarrer();
  moins.addEventListener?.('change', () => { if (moins.matches) arreter(); });
}
