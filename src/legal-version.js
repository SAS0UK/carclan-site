// La version des textes juridiques du site.
//
// Les documents de l'application vivent dans le dépôt CarClan
// (lib/features/settings/domain/legal_documents.dart, constante `updatedOn`)
// et le site les reprend mot pour mot dans sa partie « L'application ».
// tools/check-legal.mjs compare ces deux valeurs au build et refuse de
// construire si elles divergent : un site qui affiche une version des CGU
// et une application qui en affiche une autre, c'est une promesse qui ne
// tient plus.
//
// APP_VERSION doit donc toujours valoir la constante du dépôt CarClan.
// SITE_VERSION est propre aux textes du site (partie « Le site »), et ne
// change que lorsque ces textes-là changent. C'est elle qui part en base
// avec une inscription à la liste d'attente (`consent_version`), pour
// qu'on sache ce que la personne avait sous les yeux.

export const APP_VERSION = '14 septembre 2026';
export const SITE_VERSION = '21 septembre 2026';

// La même date, au format que la base attend (migration 0046 : au plus
// 32 caractères, comparée telle quelle).
export const CONSENT_VERSION = '2026-09-21';
