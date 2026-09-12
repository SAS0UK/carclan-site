// Les textes se composent et se décomposent au défilement, lettre par lettre
// pour les titres, mot par mot pour le reste. SplitText de GSAP découpe, un
// ScrollTrigger en mode scrub pilote la timeline.
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

export function setupText({ lite = false, reduced = false } = {}) {
  const panels = gsap.utils.toArray('.panel');
  const blur = (px) => (lite || reduced ? 'blur(0px)' : `blur(${px}px)`);
  let hero = null;

  panels.forEach((panel, i) => {
    if (panel.classList.contains('travel')) return;
    const title = panel.querySelector('.split');
    const lede = panel.querySelector('.split-words');
    const eyebrow = panel.querySelector('.eyebrow');
    const extras = Array.from(panel.querySelectorAll('.tags, .actions, .waitlist, .scroll-hint'));
    const chars = title ? new SplitText(title, { type: 'chars,words', charsClass: 'ch', wordsClass: 'wd' }).chars : [];
    const words = lede ? new SplitText(lede, { type: 'words', wordsClass: 'wd' }).words : [];
    const head = eyebrow ? [eyebrow] : [];
    const isFinal = panel.classList.contains('final');
    const each = Math.min(0.009, 0.24 / Math.max(chars.length, 1));

    if (i === 0) {
      gsap.set([...head, ...extras], { opacity: 0, y: 14 });
      gsap.set(chars, { opacity: 0, yPercent: 90, rotateX: -85, transformPerspective: 800, filter: blur(10) });
      gsap.set(words, { opacity: 0, y: 12, filter: blur(6) });
      hero = { chars, words, head, extras };
      gsap.timeline({ scrollTrigger: { trigger: panel, start: 'top top', end: 'bottom top', scrub: 0.6 } })
        .to(chars, { opacity: 0, yPercent: -70, scale: 1.12, rotateX: 60, transformPerspective: 800, stagger: { each, from: 'start' }, ease: 'power2.in', duration: 0.55 }, 0.05)
        .to(words, { opacity: 0, y: -14, stagger: 0.004, duration: 0.4, ease: 'power2.in' }, 0.1)
        .to([...head, ...extras], { opacity: 0, y: -10, duration: 0.3 }, 0.08);
      return;
    }

    // Trois actes sur la course du panneau : composer pendant que le bloc monte
    // vers sa place, tenir pendant qu'il est collé au centre, décomposer quand
    // il repart. Pas de flou par lettre ici : trop cher en scrub.
    const tl = gsap.timeline({
      scrollTrigger: { trigger: panel, start: 'top 80%', end: isFinal ? 'bottom bottom' : 'bottom 20%', scrub: 0.3 },
    });
    if (head.length) tl.fromTo(head, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.1, ease: 'none' }, 0.03);
    tl.fromTo(chars, { opacity: 0, yPercent: 60, scale: 0.94, rotateX: -70, transformPerspective: 800 }, { opacity: 1, yPercent: 0, scale: 1, rotateX: 0, transformPerspective: 800, duration: 0.2, stagger: { each: each * 0.7, from: 'start' }, ease: 'power3.out' }, 0.06);
    if (words.length) tl.fromTo(words, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.16, stagger: 0.003, ease: 'power2.out' }, 0.14);
    if (extras.length) tl.fromTo(extras, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.24);
    if (!isFinal) {
      tl.to(chars, { opacity: 0, yPercent: -40, scale: 1.14, rotateX: 40, transformPerspective: 800, duration: 0.12, stagger: { each: each * 0.5, from: 'end' }, ease: 'power2.in' }, 0.78);
      if (words.length) tl.to(words, { opacity: 0, y: -12, duration: 0.1, stagger: 0.002, ease: 'power2.in' }, 0.8);
      if (head.length + extras.length) tl.to([...head, ...extras], { opacity: 0, y: -10, duration: 0.08 }, 0.82);
    }
  });

  function playHero() {
    if (!hero) return null;
    const { chars, words, head, extras } = hero;
    const tl = gsap.timeline();
    tl.to(head, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0)
      .to(chars, { opacity: 1, yPercent: 0, rotateX: 0, transformPerspective: 800, filter: blur(0), duration: reduced ? 0.4 : 1.2, stagger: { each: reduced ? 0 : 0.032, from: 'start' }, ease: 'power4.out' }, 0.1)
      .to(words, { opacity: 1, y: 0, filter: blur(0), duration: 0.8, stagger: 0.018, ease: 'power3.out' }, 0.75)
      .to(extras, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' }, 1.2);
    return tl;
  }

  return { playHero };
}
