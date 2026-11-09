// Banc de tools/build-rassos.mjs (SITE-10) : la base est simulee (fetch
// remplace par un module d'import), aucun appel reseau. Usage : node tools/test-build-rassos.mjs [chemin de build-rassos]
import { mkdtempSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ICI = dirname(fileURLToPath(import.meta.url));
const script = resolve(process.argv[2] ?? join(ICI, 'build-rassos.mjs'));
const T = mkdtempSync(join(tmpdir(), 'cc-rassos-'));
const stub = join(T, 'stub.mjs');
writeFileSync(stub, `
const S = JSON.parse(process.env.SCENARIO);
globalThis.fetch = async (url) => {
  const nom = String(url).split('/rpc/')[1];
  const corps = nom === 'list_public_event_ids' ? S.ids : S.page;
  return { ok: true, status: 200, json: async () => corps };
};
`);
const UUID = '3d49e469-4cce-4aff-a297-bb08c08621cf';
const fiche = (o = {}) => ({ id: UUID, title: 'Rasso test', starts_at: '2026-12-11T09:00:00Z', ends_at: '2026-12-11T17:00:00Z', address: 'Place de test', organizer: 'Orga', ...o });
let echec = false;
const ok = (c, m) => { console.log(c ? 'ok' : 'ECHEC', m); if (!c) echec = true; };
function lancer(scenario) {
  const cwd = mkdtempSync(join(tmpdir(), 'cc-rassos-cwd-'));
  const r = spawnSync('node', ['--import', pathToFileURL(stub).href, script], { cwd, env: { ...process.env, RASSO_PAGES: '1', SCENARIO: JSON.stringify(scenario) }, encoding: 'utf8' });
  const dossier = join(cwd, 'dist', 'rasso');
  return { ...r, pages: existsSync(dossier) ? readdirSync(dossier) : [], dossier };
}

let r = lancer({ ids: [{ id: UUID }], page: fiche() });
ok(r.status === 0 && r.pages.length === 1, 'une fiche valide : une page generee');
const html = readFileSync(join(r.dossier, UUID, 'index.html'), 'utf8');
ok(/<meta name="robots" content="noindex">/.test(html), 'la page pre-rendue est noindex, comme 404.html');

r = lancer({ ids: [], page: null });
ok(r.status === 1 && r.pages.length === 0, 'liste vide : le build echoue (rien a publier par push force)');

r = lancer({ ids: [{ id: UUID }], page: null });
ok(r.status === 1, 'fiche listee mais nulle : le build echoue');

r = lancer({ ids: [{ id: '../../../etc' }], page: fiche({ id: '../../../etc' }) });
ok(r.status === 1 && r.pages.length === 0, 'identifiant non UUID : refuse, rien ecrit hors de dist/rasso');

r = lancer({ ids: [{ id: UUID }], page: fiche({ starts_at: 'n/a', ends_at: 'zzz' }) });
const h2 = existsSync(join(r.dossier, UUID, 'index.html')) ? readFileSync(join(r.dossier, UUID, 'index.html'), 'utf8') : '';
ok(r.status === 0 && !/"startDate"|"endDate"|1970/.test(h2), 'date illisible : page generee, dates omises du JSON-LD, pas de 1970');
process.exit(echec ? 1 : 0);
