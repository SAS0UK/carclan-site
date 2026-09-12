import './style.css';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { mountIcons } from './icons.js';
import { createScene } from './scene.js';
import { setupText } from './text.js';
import { setupWaitlist } from './waitlist.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
mountIcons();

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const html = document.documentElement;
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cores = navigator.hardwareConcurrency || 8;
const lite = isTouch || cores < 4 || new URLSearchParams(location.search).has('lite');
html.classList.add('locked');
if (isTouch) html.classList.add('touch');

const canvas = document.getElementById('scene');
const world = createScene(canvas, { lite, reduced, touch: isTouch, onProgress: (p) => { const bar = document.querySelector('.entry-progress span'); if (bar) bar.style.transform = `scaleX(${0.15 + p * 0.75})`; } });

// Lenis lisse la molette et le trackpad ; ScrollTrigger lit la position native.
const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1, smoothWheel: true });
lenis.stop();
lenis.on('scroll', (e) => { ScrollTrigger.update(); world.setVelocity(e.velocity || 0); });
gsap.ticker.lagSmoothing(0);
ScrollTrigger.config({ ignoreMobileResize: true });

let frames = 0, fpsAccum = 0, fpsWindow = 0, watching = false, watchStart = 0, watchFrames = 0;
const stats = new URLSearchParams(location.search).has('stats') ? makeStats() : null;

gsap.ticker.add((time, delta) => {
  lenis.raf(time * 1000);
  const dt = Math.min(delta / 1000, 0.05);
  world.update(dt);
  frames++; fpsWindow += dt;
  if (fpsWindow >= 0.5) {
    const fps = frames / fpsWindow;
    if (stats) stats.textContent = `${fps.toFixed(0)} fps · dpr ${world.dpr} · ${world.lite ? 'lite' : 'full'}`;
    if (watching) { fpsAccum += fps; watchFrames++; if (time - watchStart > 4) { watching = false; if (fpsAccum / watchFrames < 52) world.degrade(); } }
    frames = 0; fpsWindow = 0;
  }
});

ScrollTrigger.create({
  trigger: '#tour', start: 'top top', end: 'bottom bottom',
  onUpdate: (self) => world.setProgress(self.progress),
});

let text = null;
setupWaitlist(document.getElementById('waitlist'));

// Curseur
const cursor = document.createElement('div');
cursor.className = 'cursor';
document.body.appendChild(cursor);
gsap.set(cursor, { xPercent: -50, yPercent: -50, x: -100, y: -100 });
const cursorX = gsap.quickTo(cursor, 'x', { duration: 0.32, ease: 'power3' });
const cursorY = gsap.quickTo(cursor, 'y', { duration: 0.32, ease: 'power3' });
document.addEventListener('pointerover', (e) => {
  const hot = e.target.closest('a, button, input, summary');
  cursor.classList.toggle('hot', !!hot);
  const labelled = e.target.closest('[data-cursor]');
  cursor.dataset.label = labelled ? labelled.dataset.cursor : '';
  cursor.classList.toggle('labelled', !!labelled);
});

window.addEventListener('pointermove', (e) => {
  world.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  cursorX(e.clientX); cursorY(e.clientY);
}, { passive: true });
let resizeTimer = 0;
window.addEventListener('resize', () => { world.resize(); clearTimeout(resizeTimer); resizeTimer = setTimeout(computeStations, 200); });

// Les gares de la caméra suivent la mise en page : arrivée quand le texte a
// fini de se composer, départ quand il commence à se défaire.
function computeStations() {
  const vh = window.innerHeight;
  // Même dénominateur que le ScrollTrigger de #tour (qui s'arrête avant le
  // pied de page), sinon les gares glissent.
  const max = Math.max(1, document.getElementById('tour').offsetHeight - vh);
  const list = [{ p0: 0, p1: 0.012, t: 0 }];
  const panels = Array.from(document.querySelectorAll('.panel'));
  panels.forEach((panel, i) => {
    if (i === 0) return;
    const top = panel.getBoundingClientRect().top + window.scrollY;
    const h = panel.offsetHeight;
    if (panel.classList.contains('final')) { list.push({ p0: Math.min(1, (top - vh * 0.7) / max), p1: 1, t: 1 }); return; }
    const start = top - vh * 0.8, end = top + h - vh * 0.2;
    list.push({ p0: (start + 0.3 * (end - start)) / max, p1: (start + 0.76 * (end - start)) / max, t: i / 5 });
  });
  world.setStations(list);
}

// Ancres en défilement doux
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 2.4, easing: (t) => 1 - Math.pow(1 - t, 3) });
  });
});

// L'entrée
const entry = document.getElementById('entry');
const bar = entry.querySelector('.entry-progress span');
const enterBtn = document.getElementById('enter');
const topbar = document.querySelector('.topbar');

async function load() {
  bar.style.transform = 'scaleX(.15)';
  await document.fonts.ready;
  text = setupText({ lite, reduced });
  await world.ready;
  bar.style.transform = 'scaleX(1)';
  entry.classList.add('ready');
  enterBtn.disabled = false;
}

function enter() {
  gsap.set(entry, { pointerEvents: 'none' });
  gsap.timeline()
    .to(entry.querySelector('.wordmark'), { letterSpacing: '0.9em', duration: 1.3, ease: 'power3.in' }, 0)
    .to(entry.querySelector('.entry-inner'), { opacity: 0, scale: 1.1, filter: reduced ? 'blur(0px)' : 'blur(12px)', duration: 1.1, ease: 'power3.in' }, 0)
    .to(entry, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 0.5);
  world.enter();
  gsap.delayedCall(reduced ? 0.2 : 3.1, () => text && text.playHero());
  gsap.delayedCall(reduced ? 0.5 : 4.6, () => {
    html.classList.remove('locked');
    lenis.start();
    ScrollTrigger.refresh();
    computeStations();
    topbar.classList.add('on');
  });
  setTimeout(() => entry.remove(), 1700);
  watching = true; watchStart = gsap.ticker.time; fpsAccum = 0; watchFrames = 0;
}

enterBtn.addEventListener('click', enter, { once: true });
load();

function makeStats() {
  const el = document.createElement('div');
  el.className = 'stats';
  document.body.appendChild(el);
  return el;
}
