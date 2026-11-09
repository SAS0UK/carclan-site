// Ce que `check-legal.mjs` et `stamp-legal.mjs` partagent : où est le fichier
// des textes de l'application, et son empreinte SHA-256.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// `tools/sync-legal.dart` importe `../../car_clan/…` : le dépôt voisin. C'est
// donc lui, et lui seul, que l'extraction lit ; `stamp-legal` n'accepte pas
// d'autre dossier.
export const APP_PAR_DEFAUT = resolve(homedir(), 'DEV/car_clan');
export const cheminDart = (dossierApp) =>
  resolve(dossierApp, 'lib/features/settings/domain/legal_documents.dart');

export const empreinteDe = (chemin) =>
  existsSync(chemin) ? createHash('sha256').update(readFileSync(chemin)).digest('hex') : null;
