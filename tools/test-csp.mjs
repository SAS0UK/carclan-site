// Banc de tools/csp.mjs (SITE-8). Usage : node tools/test-csp.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { poserCsp, verifierCsp } from './csp.mjs';

let echec = false;
const ok = (c, m) => { console.log(c ? 'ok' : 'ECHEC', m); if (!c) echec = true; };
const page = (corps = '') => `<!doctype html><html><head><meta charset="utf-8"><title>t</title>
<style>a{color:red}</style><script>window.__x=1</script><script type="application/ld+json">{"a":1}</script>
<script type="module" src="/a.js"></script></head><body>${corps}</body></html>`;
const dossier = () => { const d = mkdtempSync(join(tmpdir(), 'cc-csp-')); mkdirSync(join(d, 'sous')); return d; };
const ecrire = (d, f, h) => writeFileSync(join(d, f), h);

let d = dossier();
ecrire(d, 'index.html', page()); ecrire(d, 'sous/index.html', page());
ok(verifierCsp(d).length === 2, 'sans CSP : la vérification refuse chaque page');
poserCsp(d);
ok(verifierCsp(d).length === 0, 'CSP posée : la vérification passe');
poserCsp(d);
ok((readFileSync(join(d, 'index.html'), 'utf8').match(/Content-Security-Policy/g) ?? []).length === 1, 'poser deux fois : une seule balise');
const h = readFileSync(join(d, 'index.html'), 'utf8');
ok(h.indexOf('Content-Security-Policy') < h.indexOf('<style>') && h.indexOf('charset') < h.indexOf('Content-Security-Policy'), 'la CSP suit le charset et précède tout bloc');
ok(!/unsafe-inline/.test(h), "jamais 'unsafe-inline'");
ok((h.match(/sha256-/g) ?? []).length === 2, 'une empreinte pour le script et une pour le style, aucune pour le JSON-LD');
ok(/name="referrer"/.test(h), 'referrer posé');

ecrire(d, 'index.html', h.replace('window.__x=1', 'window.__x=2'));
ok(verifierCsp(d).some((p) => /script en ligne sans empreinte/.test(p)), 'script changé après la pose : refusé');
ecrire(d, 'index.html', h.replace('a{color:red}', 'a{color:blue}'));
ok(verifierCsp(d).some((p) => /style en ligne sans empreinte/.test(p)), 'style changé après la pose : refusé');
ecrire(d, 'index.html', h.replace('<body>', '<body><p style="color:red" onclick="x()">'));
const p = verifierCsp(d).join('|');
ok(/attribut style/.test(p) && /gestionnaire on/.test(p), 'style="" et onclick="" : refusés');
ecrire(d, 'index.html', h.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"));
ok(verifierCsp(d).some((q) => /unsafe-inline/.test(q)), "'unsafe-inline' dans la politique : refusé");
ecrire(d, 'index.html', h.replace('<body>', '<body><iframe src="https://x.test"></iframe>'));
ok(verifierCsp(d).some((q) => /iframe/.test(q)), 'iframe : refusé');
process.exit(echec ? 1 : 0);
