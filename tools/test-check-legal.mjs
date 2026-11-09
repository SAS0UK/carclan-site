// Banc de `check-legal.mjs` (SITE-6) : une phrase qui change sans que la date
// bouge doit faire échouer le contrôle. Usage : node tools/test-check-legal.mjs [chemin de check-legal]
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ICI = dirname(fileURLToPath(import.meta.url));
const script = resolve(process.argv[2] ?? join(ICI, 'check-legal.mjs'));
const dart = (phrase) => `class LegalDocuments {\n  static const updatedOn = '6 novembre 2026';\n  static const x = '${phrase}';\n}\n`;
const app = mkdtempSync(join(tmpdir(), 'cc-app-'));
mkdirSync(join(app, 'lib/features/settings/domain'), { recursive: true });
const fichier = join(app, 'lib/features/settings/domain/legal_documents.dart');
const sha = (t) => createHash('sha256').update(t).digest('hex');
const json = join(mkdtempSync(join(tmpdir(), 'cc-json-')), 'app-documents.json');
const lancer = () => spawnSync('node', [script], { env: { ...process.env, CARCLAN_APP: app, CARCLAN_LEGAL_JSON: json }, encoding: 'utf8' });
let echec = false;
const ok = (c, m) => { if (!c) { console.log('ECHEC', m); echec = true; } else console.log('ok', m); };

writeFileSync(fichier, dart('Nous gardons vos données 30 jours.'));
writeFileSync(json, JSON.stringify({ updatedOn: '6 novembre 2026', sourceSha256: sha(dart('Nous gardons vos données 30 jours.')) }));
ok(lancer().status === 0, 'texte et date inchangés : passe');

writeFileSync(fichier, dart('Nous gardons vos données 90 jours.'));
const r = lancer();
ok(r.status === 1, 'phrase changée, date inchangée : le contrôle échoue');

writeFileSync(json, JSON.stringify({ updatedOn: '6 novembre 2026' }));
ok(lancer().status === 0, 'JSON sans empreinte (ancien format) : passe avec un message de resynchronisation');
process.exit(echec ? 1 : 0);
