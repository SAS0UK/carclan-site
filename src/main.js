// L'accueil de carclan.fr. Le HTML se suffit : tout ce qui suit est un
// supplément, jamais une condition pour lire la page. La scène 3D se charge
// après le contenu, dans un temps mort du navigateur, et n'existe pas pour
// qui a demandé moins de mouvement.
import './tokens.css';
import './site.css';
import { mountIcons } from './icons.js';
import { setupWaitlist } from './waitlist.js';

mountIcons();
setupWaitlist(document.getElementById('waitlist'));

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
const cores = navigator.hardwareConcurrency || 8;
const params = new URLSearchParams(location.search);
const lite = touch || cores < 4 || params.has('lite');

// Les apparitions : une fois, à l'entrée dans l'écran, huit pixels de
// translation. Sans JavaScript, ou en mouvement réduit, tout est visible
// d'emblée (voir site.css, html.js [data-reveal]).
if (!reduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
} else {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
}

// La barre haute se remplit d'un voile dès qu'on quitte le haut de page.
const topbar = document.querySelector('.topbar');
const onScroll = () => topbar && topbar.classList.toggle('on', window.scrollY > 24);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---- La scène ------------------------------------------------------------------
const canvas = document.getElementById('scene');

async function mountScene() {
  if (!canvas || params.has('noscene')) return;
  let world;
  try {
    const { createScene } = await import('./scene.js');
    world = createScene(canvas, { lite, reduced, touch });
  } catch (err) {
    // Pas de WebGL, ou un pilote qui refuse : la page reste entière.
    console.warn('Scène indisponible :', err);
    canvas.remove();
    return;
  }

  const doc = document.documentElement;
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    world.setProgress(window.scrollY / max);
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', () => { world.resize(); update(); });
  update();
  world.start();

  // Quatre secondes de mesure après le départ : sous 45 images par
  // seconde, on dégrade une fois, sans le dire.
  if (!reduced) {
    let frames = 0;
    const t0 = performance.now();
    const count = () => {
      frames++;
      const t = performance.now() - t0;
      if (t < 4000) requestAnimationFrame(count);
      else if (frames / (t / 1000) < 45) world.degrade();
    };
    requestAnimationFrame(count);
  }
}

// La scène ne démarre qu'une fois la page entièrement chargée, puis dans un
// temps mort du navigateur. Monter trois cents objets et compiler leurs
// shaders coûte près de deux secondes de fil principal : fait plus tôt, ce
// travail retarde le premier clic possible sur « Être prévenu », qui est la
// seule chose que la page ait à faire. La scène est un décor, elle passe
// après.
function planifierScene() {
  // Une seconde de marge après le chargement, PUIS un temps mort. Le shader
  // du sol est gros (bruit cellulaire, boucle sur quatorze lampes, sept
  // prélèvements de reflet) et sa compilation bloque le fil principal
  // quelques centaines de millisecondes : mesuré à 460 ms au montage
  // immédiat, contre 90 ms une fois sorti de la fenêtre de chargement. Rien
  // sur cette page n'attend la scène, et la personne qui arrive doit pouvoir
  // cliquer « Être prévenu » tout de suite.
  const lancer = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(mountScene, { timeout: 4000 });
    else setTimeout(mountScene, 400);
  };
  setTimeout(lancer, 1000);
}

if (document.readyState === 'complete') planifierScene();
else window.addEventListener('load', planifierScene, { once: true });
