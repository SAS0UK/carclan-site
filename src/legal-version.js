// La version du consentement à la liste d'attente du site.
//
// C'est la seule valeur de ce fichier : elle part en base avec une
// inscription (`consent_version`, lue par `src/waitlist.js`), pour qu'on
// sache quel texte la personne avait sous les yeux. La date affichée en tête
// des textes du site est `SITE_VERSION`, dans `src/legal/site-documents.js` ;
// celle des textes de l'application vient du JSON que `tools/check-legal.mjs`
// compare au dépôt CarClan. Les deux anciennes copies (APP_VERSION,
// SITE_VERSION) ne servaient à rien et sont parties le 9 novembre 2026
// (relecture complète, SITE-7).
//
// Quand les textes du site changent : changer SITE_VERSION dans
// `site-documents.js` ET la date ci-dessous, le même jour.

// La même date, au format que la base attend (migration 0046 : au plus
// 32 caractères, comparée telle quelle). L'heure départage deux versions
// d'un même jour : '2026-09-28' reste celle des inscrits d'avant 16 h 30.
export const CONSENT_VERSION = '2026-11-03';
