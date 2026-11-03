// Banc de la fonction Edge `waitlist` (build 16) : Deno, la base et Resend
// simulés, 15 vérifications de ce que la fonction envoie et répond.
import { createHash } from 'node:crypto';
const env = { SUPABASE_URL: 'https://base.test', SUPABASE_SERVICE_ROLE_KEY: 'cle-service', RESEND_API_KEY: 'cle-resend' };
let handler;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const appels = []; let reponseBase = 'envoyer';
globalThis.fetch = async (url, init) => {
  appels.push({ url, init });
  if (url.includes('/rpc/waitlist_inscrire')) return new Response(JSON.stringify(reponseBase), { status: 200 });
  if (url.includes('/rpc/waitlist_confirmer')) return new Response(JSON.stringify(JSON.parse(init.body).p_confirmation_hash === globalThis.bonHash), { status: 200 });
  if (url.includes('resend')) return new Response('{}', { status: 200 });
  throw new Error('appel inattendu ' + url);
};
// Usage : cp supabase/functions/waitlist/index.ts /tmp/wl.mts && node --experimental-strip-types tools/banc-waitlist.mjs /tmp/wl.mts
await import(process.argv[2]);
const post = (corps, ip = '1.2.3.4') => handler(new Request('https://f/', { method: 'POST', headers: { origin: 'https://carclan.fr', 'cf-connecting-ip': ip, 'content-type': 'application/json' }, body: JSON.stringify(corps) }));
const sha = (t) => createHash('sha256').update(t).digest('hex');
const ok = (c, m) => { if (!c) { console.log('ECHEC', m); process.exitCode = 1; } else console.log('ok', m); };

let r = await post({ email: 'a@b.fr', consent_version: '2026-11-03' });
ok((await r.json()).etat === 'fait', 'neuve : fait');
const ins = JSON.parse(appels.find((a) => a.url.includes('inscrire')).init.body);
const mail = JSON.parse(appels.find((a) => a.url.includes('resend')).init.body);
const jeton = mail.text.match(/jeton=([0-9a-f]{64})/)[1];
ok(ins.p_confirmation_hash === sha(jeton), 'la base reçoit l empreinte du jeton, pas le jeton');
ok(!JSON.stringify(ins).includes(jeton), 'le jeton ne part pas en base');
ok(ins.p_ip_empreinte === sha('cle-service:1.2.3.4') && !JSON.stringify(ins).includes('1.2.3.4'), 'IP en empreinte salée seulement');
ok(mail.html.includes(`https://carclan.fr/confirmer/?jeton=${jeton}`) && mail.subject.startsWith('Confirmez'), 'e-mail avec le lien');
const images = [...mail.html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
ok(images.length === 1 && images[0] === 'https://carclan.fr/email/logo.png' && !/url\(/.test(mail.html), 'une seule image, à adresse fixe : aucun pixel espion');
ok(appels.find((a) => a.url.includes('inscrire')).init.headers.Authorization === 'Bearer cle-service', 'clé de service');

appels.length = 0; reponseBase = 'rien';
r = await post({ email: 'a@b.fr', consent_version: '2026-11-03' });
ok((await r.json()).etat === 'fait' && !appels.some((a) => a.url.includes('resend')), 'déjà là : même réponse, aucun e-mail');

appels.length = 0;
r = await post({ email: 'a@b.fr', consent_version: 'x', website: 'robot' });
ok((await r.json()).etat === 'fait' && appels.length === 0, 'pot de miel : rien en base');
r = await post({ email: 'pas-une-adresse', consent_version: 'x' });
ok((await r.json()).etat === 'invalide', 'adresse invalide');
r = await post({ email: 'a@b.fr', consent_version: '' });
ok((await r.json()).etat === 'invalide', 'consentement vide');

globalThis.bonHash = sha(jeton);
r = await post({ jeton });
ok((await r.json()).etat === 'confirme', 'bon jeton : confirmé');
r = await post({ jeton: 'f'.repeat(64) });
ok((await r.json()).etat === 'invalide', 'faux jeton : invalide');
appels.length = 0;
r = await post({ jeton: 'abc' });
ok((await r.json()).etat === 'invalide' && appels.length === 0, 'jeton mal formé : rien n appelle la base');
r = await handler(new Request('https://f/', { method: 'GET' }));
ok(r.status === 405, 'GET refusé');
