// EDGE-10 : les pages de passage des e-mails d'authentification de l'app
// (/compte/confirmer/ et /compte/mot-de-passe/). Aucune ne consomme le lien en
// s'ouvrant : une messagerie ou un antivirus qui ouvre les liens avant la
// personne le brûlerait. Le banc tient la logique (src/compte-jeton.js) et les
// pages (noindex, no-referrer, vouvoiement, entrées Vite, liens d'app).
// Usage : node tools/test-pages-compte.mjs
import { readFileSync, existsSync } from 'node:fs';
let echecs = 0;
const ok = (c, m) => { if (!c) { echecs++; console.log('ECHEC', m); } else console.log('ok', m); };
const lire = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const J = 'a'.repeat(56);
let mod = null;
try { mod = await import('../src/compte-jeton.js'); } catch (e) { ok(false, `src/compte-jeton.js se charge (${e.code ?? e.message})`); }

if (mod) {
  const { jetonDuLien, verifier, lienApp, MESSAGES } = mod;
  ok(jetonDuLien(`?token_hash=${J}&type=email`) === J, 'jeton lu dans le lien');
  ok(jetonDuLien(`?token_hash=pkce_${J}`) === `pkce_${J}`, 'jeton à préfixe pkce_ accepté');
  ok(jetonDuLien('?token_hash=') === '' && jetonDuLien('') === '', 'sans jeton : vide');
  ok(jetonDuLien('?token_hash=a b/../c') === '' && jetonDuLien(`?token_hash=${'a'.repeat(400)}`) === '', 'jeton mal formé : vide');
  ok(lienApp(J) === `carclan://reset-password?token_hash=${J}&type=recovery`, 'lien de l\'app pour le mot de passe');

  const appels = [];
  const faux = (statut, corps, leve) => async (url, init) => { appels.push({ url, init }); if (leve) throw new Error('réseau'); return new Response(JSON.stringify(corps), { status: statut }); };
  let r = await verifier(J, faux(200, { access_token: 'x', user: {} }));
  const a = appels[0];
  ok(a.url === 'https://zheixbgssdfquresgtai.supabase.co/auth/v1/verify' && a.init.method === 'POST', 'POST /auth/v1/verify');
  ok(JSON.stringify(JSON.parse(a.init.body)) === JSON.stringify({ type: 'email', token_hash: J }), 'corps : type email et token_hash');
  ok(a.init.headers.apikey?.startsWith('sb_publishable_') && !a.init.headers.Authorization, 'clé publique, pas d\'Authorization');
  ok(r === 'confirme', '200 : confirmé');
  ok(await verifier(J, faux(403, { error_code: 'otp_expired', msg: 'Email link is invalid or has expired' })) === 'mort', 'lien expiré : mort');
  ok(await verifier(J, faux(410, { error_code: 'otp_expired' })) === 'mort', '410 : mort');
  ok(await verifier(J, faux(401, { msg: 'Token has expired or is invalid' })) === 'mort', '401 : mort');
  ok(await verifier(J, faux(500, {})) === 'reessayer', '500 : réessayer');
  ok(await verifier(J, faux(429, {})) === 'reessayer', '429 : réessayer');
  ok(await verifier(J, faux(0, {}, true)) === 'reessayer', 'réseau coupé : réessayer');
  ok(MESSAGES.mort.length === 2 && /app/i.test(MESSAGES.mort[1]) && /Renvoyer l’e-mail/.test(MESSAGES.mort[1]), 'lien mort : dit de redemander l\'e-mail depuis l\'app');
}

const pages = { 'compte/confirmer/index.html': 'src/compte-confirmer.js', 'compte/mot-de-passe/index.html': 'src/compte-mot-de-passe.js' };
for (const [page, script] of Object.entries(pages)) {
  const ex = existsSync(new URL(`../${page}`, import.meta.url));
  ok(ex, `${page} existe`);
  if (!ex) continue;
  const h = lire(page);
  ok(/<meta name="robots" content="noindex, nofollow"/.test(h), `${page} : noindex`);
  ok(/<meta name="referrer" content="no-referrer"/.test(h), `${page} : no-referrer`);
  ok(h.includes(`src="/${script}"`), `${page} charge ${script}`);
  const visible = h.replace(/<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]+>/g, ' ');
  ok(!/\b(tu|ton|ta|tes|toi|te|t’|ouvre|touche|confirme|réessaie|écris|laisse)\b/i.test(visible), `${page} : au vous, aucun tutoiement`);
  ok(/Touchez/.test(visible), `${page} : bouton annoncé au vous`);
}
const mdp = existsSync(new URL('../src/compte-mot-de-passe.js', import.meta.url)) ? lire('src/compte-mot-de-passe.js') : '';
ok(/lienApp/.test(mdp) && !/\/auth\/v1\/verify/.test(mdp), 'page mot de passe : ouvre l\'app, ne consomme rien');
const conf = existsSync(new URL('../src/compte-confirmer.js', import.meta.url)) ? lire('src/compte-confirmer.js') : '';
ok(/addEventListener\('click'/.test(conf) && !/^verifier\(/m.test(conf), 'page inscription : ne vérifie qu\'au clic');

const vite = lire('vite.config.js');
ok(vite.includes("'compte/confirmer/index.html'") && vite.includes("'compte/mot-de-passe/index.html'"), 'vite.config.js : deux entrées');
const aasa = lire('public/.well-known/apple-app-site-association') + lire('public/.well-known/assetlinks.json');
ok(!/\/compte/.test(aasa) && !/"\/\*"|"\/"\s*:\s*"\*"/.test(aasa), 'l\'app ne capte pas /compte/* (la page doit s\'afficher)');
process.exit(echecs ? 1 : 0);
