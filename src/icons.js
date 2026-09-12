// Sous-ensemble du jeu d'icônes CarClan (tools/carclan-icons.js du dépôt de
// l'application) : grille 24, trait 2, bouts ronds, le « point » comme motif.
const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const dot = (x, y, r = 2.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;

const ICONS = {
  point: `<path d="M17.7 6.3A8 8 0 1 0 17.7 17.7" ${S}/>${dot(12, 12)}`,
  dates: `<rect x="4" y="5" width="16" height="15" rx="2" ${S}/><path d="M4 10h16M8 3v4M16 3v4" ${S}/>${dot(12, 15)}`,
  lieu: `<path d="M17.7 6.3A8 8 0 1 0 17.7 17.7" ${S}/>${dot(12, 12)}`,
  filtres: `<path d="M4 7h16M4 12h16M4 17h16" ${S}/>${dot(9, 7)}${dot(15, 12)}${dot(11, 17)}`,
  participer: `<circle cx="12" cy="12" r="8.5" ${S}/><path d="M8 12l3 3 5-6" ${S}/>`,
  itineraire: `<path d="M5 20v-9a4 4 0 0 1 4-4h9M15 4l3 3-3 3" ${S}/>`,
  amis: `${dot(8, 8, 3)}${dot(16, 9, 2.5)}<path d="M2 19a6 6 0 0 1 12 0M13 18a5 5 0 0 1 9 0" ${S}/>`,
  camera: `<path d="M4 8h4l2-3h4l2 3h4v11H4z" ${S}/><circle cx="12" cy="13" r="3" ${S}/>`,
  commenter: `<path d="M6 5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4 4v-4H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" ${S}/>`,
  communaute: `<circle cx="9" cy="12" r="5.5" ${S}/><circle cx="15" cy="12" r="5.5" ${S}/>`,
  suivant: `<path d="M4 12h16M14 6l6 6-6 6" ${S}/>`,
  check: `<path d="M5 12l5 5 9-10" ${S}/>`,
  chevron: `<path d="M9 5l7 7-7 7" ${S}/>`,
};

export function mountIcons() {
  if (document.getElementById('cc-sprite')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'cc-sprite';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = Object.entries(ICONS)
    .map(([k, v]) => `<symbol id="cc-${k}" viewBox="0 0 24 24">${v}</symbol>`)
    .join('');
  document.body.prepend(svg);
}
