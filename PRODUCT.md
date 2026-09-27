# Product
<!-- impeccable:product-schema 1 -->

> Rédigé le 27 septembre 2026 sans entretien : le fondateur dormait et avait
> demandé d'avancer seul. Tout ce qui suit vient de la mémoire du projet et du
> code des deux dépôts ; les points déduits sont marqués « (déduit) ».

## Platform
web

## Users
- **Le passionné d'auto du Nord**, 18-30 ans surtout, qui va aux rassos (rassemblements automobiles) le soir ou le dimanche. Il découvre carclan.fr sur son téléphone, souvent debout sur un parking, montré par quelqu'un, ou via un lien en bio TikTok, YouTube ou taplink. Son geste attendu : laisser son e-mail pour être prévenu de la sortie.
- **L'organisateur de rassos** (clubs, pages Instagram, organisateurs de nocturnes et d'expos) : il veut savoir si CarClan lui apporte du monde et comment publier ses dates.
- **Le commerçant ou partenaire** (garage, préparateur, enseigne qui prête un parking).
- Public plus âgé présent aussi : le fondateur l'a posé comme contrainte le 22 septembre 2026 (« des personnes âgées ou avec une vision un peu moindre »).

## Product Purpose
CarClan est une application mobile iOS et Android, gratuite, des rassemblements automobiles. Elle n'est pas encore sortie (« cet hiver »). Le site carclan.fr est la vitrine de pré-lancement : faire comprendre l'app en quelques secondes, donner l'image d'un produit premium et fini, et recueillir des e-mails pour la liste d'attente. Succès : des inscriptions réelles, et des visiteurs qui repartent convaincus.

## Positioning
Six à quatorze applis concurrentes, aucune avec de la traction. CarClan revendique l'exhaustivité (« Tous les rassos. Un seul clan. ») et une exécution soignée. Ce qu'aucun concurrent ne montre : la carte « au sodium » (les rues éclairées d'ambre, un rasso en cours qui pulse), l'inscription en un geste avec « Qui vient » et leurs voitures, le chat en direct pendant le rasso, le fil de photos après, le garage de chacun, les clans (un organisateur et ses habitués). Né à Tourcoing, démarre dans les Hauts-de-France.

## Operating Context
- Rassos : expos, rassos statiques, balades (convois), trackdays (piste), rallyes légaux, séances photo, rencontres de marque, rencontres de club, compétitions officielles.
- Neuf types dans l'app, chacun avec son mot d'affiche : RASSO, COURSE, PISTE, EXPO, RALLYE, BALADE, PHOTO, MARQUE, CLUB.
- Dans l'app : cinq onglets Rassos, Carte, Clan, Messages, Profil. « Je participe » devient « Vous y allez ». Itinéraire délégué à Waze, Google Maps ou Plans. Page publique d'un rasso sur carclan.fr/rasso/<id>, lien court carclan.fr/r/<code>, partage en story Instagram et Snapchat.

## Capabilities and Constraints
- Stack : Vite 8, HTML/CSS/JS natif, sans framework. Déploiement `npm run deploy` (pousse `dist/` sur `gh-pages`, servi par GitHub Pages) puis `git push origin main`.
- Formulaire de liste d'attente : fonction Edge Supabase `waitlist` (inscrit puis envoie un accusé de réception), repli par insertion directe. Compteur d'inscrits masqué sous 50.
- Aucun cookie, aucun stockage navigateur, aucun traceur, aucune mesure d'audience : c'est une promesse écrite de la page `/cookies/`, gardée par `tools/check-trackers.mjs`.
- Pages légales générées depuis l'app (`tools/sync-legal.dart`, `tools/build-legal.mjs`), gardées par `check-legal`. Gardes aussi sur les `alt` et deux couples de contraste interdits.
- Aucun paiement ni transaction dans l'app. Gratuit. Rassos uniquement dans des lieux privés, autorisés ou tolérés.
- Pas encore sur les stores : aucun badge officiel App Store ou Google Play avant la publication.
- Le site vouvoie.

## Brand Commitments
- Nom : CarClan (mot-symbole CARCLAN). Slogan choisi par le fondateur : « Tous les rassos. Un seul clan. »
- Direction artistique « Sodium » de l'application, que le site doit prolonger : fond nuit, un seul accent ambre (#E2A21F, la couleur d'une lampe au sodium), police Archivo seule. Le fondateur veut du premium, et surtout rien qui « fasse IA » ou « vibe-codé ».
- Logo « Le Maillon » (`public/le-maillon.svg`).

## Evidence on Hand
- Captures de la vraie application redessinée (planche de données fictives, le 27 septembre 2026).
- Affiches générées de l'app (typographie du type de rasso + lueur de lampadaire).
- Rendus de la carte au sodium de la métropole lilloise.
- **Absents, à ne jamais fabriquer** : utilisateurs, témoignages, chiffres d'usage, partenaires, presse, photos de vraies voitures (aucun droit), photos de personnes. La base ne contient que des rassos de démonstration. Zéro utilisateur réel à ce jour.

## Product Principles
1. Montrer le produit qui marche plutôt que le promettre.
2. Ne rien affirmer qui ne soit vrai aujourd'hui (pas de faux compteur, pas de fausse preuve sociale).
3. Le téléphone d'abord : la page est d'abord vue debout sur un parking.
4. Un seul geste demandé : laisser son e-mail.
5. La confidentialité est un argument, pas une mention légale.

## Accessibility & Inclusion
Lisible par des personnes âgées ou malvoyantes (contrainte du fondateur) : texte agrandissable sans casse, contrastes AA au minimum, cibles tactiles de 44 px, mouvement réduit respecté, page lisible sans JavaScript.
