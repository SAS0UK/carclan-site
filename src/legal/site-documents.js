// Les textes juridiques propres au site carclan.fr.
//
// Règle de rédaction, la même que pour les documents de l'application :
// ne rien écrire que le code ne fasse. Chaque phrase sur les données
// correspond à une requête réellement émise par ce site, vérifiée le
// 21 septembre 2026 dans `src/waitlist.js`, `public/404.html` et sur le site
// en ligne (`curl -I https://carclan.fr` : aucun `Set-Cookie`).
//
// Les prestataires, les sociétés qui les exploitent et leurs transferts hors
// de l'Union ont été revus le 28 septembre 2026 sur leurs propres textes :
// accords de traitement des données de Supabase et de Resend, déclaration de
// confidentialité de GitHub. Ce qu'on n'a pas pu vérifier n'est pas écrit :
// la région d'où Resend envoie les e-mails du site, par exemple, n'est pas
// affirmée, parce que seul son tableau de bord la dit.
//
// Les textes de l'application ne sont pas ici : ils sont extraits du code de
// CarClan par `tools/sync-legal.dart` et repris mot pour mot par
// `tools/build-legal.mjs`.
//
// Balisage accepté dans les chaînes : **gras** et [texte](adresse).

// Doit valoir SITE_VERSION de `src/legal-version.js`, qui part en base avec
// une inscription à la liste d'attente. Les textes du site ont changé le
// 27 septembre 2026 (commit ca779d3) sans que cette date-ci suive : les pages
// affichaient encore le 21.
// Le 28 septembre 2026 à 16 h 30 : la durée de la liste d'attente décidée par
// Mathys (jusqu'au site vitrine, au plus tard fin 2027) et l'export d'analyse
// détruit après usage. Les inscrits d'avant gardent la durée qu'on leur avait
// annoncée, que `consent_version` permet de retrouver.
export const SITE_VERSION = '28 septembre 2026, 16 h 30';

const EDITEUR = 'Mathys Liénart';
const VILLE = 'Tourcoing (France)';
const CONTACT = 'contact@carclan.fr';

export const PAGES = [
  // ----------------------------------------------------------------- Mentions
  {
    chemin: 'mentions-legales',
    titre: 'Mentions légales',
    version: SITE_VERSION,
    description: 'Qui édite carclan.fr, qui en est le directeur de la publication, où le site et les données sont hébergés, et comment nous écrire.',
    chapeau: 'Qui édite ce site, où il est hébergé, et comment nous joindre. Ces informations sont celles que la loi pour la confiance dans l’économie numérique impose à tout site français.',
    sections: [
      {
        titre: 'Éditeur du site',
        blocs: [
          `Le site **carclan.fr** est édité par **${EDITEUR}**, personne physique domiciliée à ${VILLE}.`,
          `Contact : [${CONTACT}](mailto:${CONTACT}).`,
          {
            encadre: [
              'CarClan est aujourd’hui un projet personnel, sans activité commerciale et sans société. L’éditeur agit donc à titre non professionnel, au sens du II de l’article 1-1 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique, qui permet à un éditeur non professionnel de ne publier ni son domicile ni son numéro de téléphone, à condition d’avoir communiqué à l’hébergeur du site ses nom, prénoms, domicile et numéro de téléphone. Dès qu’une structure sera immatriculée, cette page portera sa dénomination, son adresse, son numéro d’immatriculation et, le cas échéant, son numéro de TVA.',
            ],
          },
        ],
      },
      {
        titre: 'Directeur de la publication',
        blocs: [
          `Le directeur de la publication est **${EDITEUR}**, joignable à [${CONTACT}](mailto:${CONTACT}).`,
        ],
      },
      {
        titre: 'Hébergement du site',
        blocs: [
          'Les pages de carclan.fr sont hébergées par :',
          {
            defs: [
              ['GitHub, Inc. (GitHub Pages)', '88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis. Téléphone : +1 877 448 4820. Site : github.com.'],
            ],
          },
          'Ce service se limite à servir des fichiers : il ne reçoit ni compte, ni mot de passe, ni contenu que vous saisiriez sur ce site. Il enregistre en revanche l’adresse IP des visiteurs, pour la sécurité de son service.',
        ],
      },
      {
        titre: 'Hébergement des données',
        blocs: [
          'Les données que ce site enregistre, c’est-à-dire les adresses de la liste d’attente, et celles de l’application CarClan sont hébergées par :',
          {
            defs: [
              ['Supabase Pte. Ltd', '65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513. Base de données, authentification et stockage des fichiers, sur des serveurs Amazon Web Services situés à Francfort, en Allemagne, dans l’Union européenne.'],
              ['Resend (Plus Five Five, Inc.)', '2261 Market Street #5039, San Francisco, CA 94114, États-Unis. Envoi des courriels liés à un compte de l’application, et des deux courriels de la liste d’attente (la confirmation d’inscription, puis l’annonce de la sortie). La société traite l’essentiel de ses données aux États-Unis.'],
            ],
          },
          'Supabase, Resend et GitHub sont établis hors de l’Union européenne. La [politique de confidentialité](/confidentialite/) détaille ce qui est collecté, pourquoi, pendant combien de temps, et comment ces transferts sont encadrés.',
        ],
      },
      {
        titre: 'Propriété intellectuelle',
        blocs: [
          'Le nom CarClan, le logo, l’identité visuelle, les textes, les visuels créés pour ce site et le code de l’application appartiennent à l’éditeur. Ils ne peuvent être copiés, modifiés ou rediffusés sans accord écrit. Les fonds de carte font exception : leurs données appartiennent à leurs contributeurs (voir les crédits).',
          'Les affiches de rassemblement présentées sur ce site sont générées par l’application CarClan. Elles ne reprennent aucune photographie ni aucun modèle appartenant à un tiers. Les écrans de l’application montrés sur ce site portent des données d’exemple : les rassemblements, organisateurs et messages qu’on y lit sont fictifs.',
          'Les marques et les noms de véhicules éventuellement cités appartiennent à leurs titulaires respectifs et ne sont mentionnés qu’à titre de référence.',
        ],
      },
      {
        titre: 'Crédits',
        blocs: [
          {
            defs: [
              ['Archivo', 'Police de caractères de Omnibus-Type, distribuée sous licence SIL Open Font 1.1. Le texte de la licence est servi à l’adresse [carclan.fr/fonts/OFL-Archivo.txt](/fonts/OFL-Archivo.txt).'],
              ['Cartes', 'Les vues de la métropole lilloise et des Hauts-de-France sont rendues à partir des données © [contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright) (licence ODbL), des tuiles © [OpenMapTiles](https://openmaptiles.org/) et du service [OpenFreeMap](https://openfreemap.org/), dans le style de la carte de l’application. Elles sont servies par ce site : aucune requête ne part vers ces services quand vous le consultez.'],
            ],
          },
        ],
      },
      {
        titre: 'Signaler un contenu',
        blocs: [
          `Pour signaler un contenu illicite, contester une décision de modération dans l’application, ou pour toute réclamation, écrivez à [${CONTACT}](mailto:${CONTACT}). Réponse sous un mois.`,
        ],
      },
    ],
  },

  // ---------------------------------------------------------- Confidentialité
  {
    chemin: 'confidentialite',
    titre: 'Politique de confidentialité',
    version: SITE_VERSION,
    description: 'Ce que le site carclan.fr collecte, pourquoi, où c’est stocké et comment exercer vos droits. Suivi de la politique de confidentialité de l’application CarClan.',
    chapeau: 'Cette page couvre **deux choses distinctes** : le site carclan.fr, que vous êtes en train de lire, puis l’application CarClan. Les deux ne collectent pas les mêmes données, et les distinguer évite de vous faire lire des pages qui ne vous concernent pas.',
    app: 'privacy',
    appTitre: 'L’application CarClan',
    sections: [
      {
        titre: 'Le site carclan.fr',
        blocs: [
          {
            encadre: [
              '**Ce site ne dépose aucun cookie, n’utilise aucun traceur et ne mesure pas son audience.** Il n’enregistre qu’une seule chose, et seulement si vous la saisissez vous-même : votre adresse e-mail, pour vous prévenir de la sortie de l’application. Si vous nous écrivez, nous gardons aussi votre message, pour vous répondre.',
            ],
          },
          `Le responsable du traitement est **${EDITEUR}**, ${VILLE}, joignable à [${CONTACT}](mailto:${CONTACT}).`,
        ],
      },
      {
        titre: 'La liste d’attente',
        blocs: [
          'C’est le seul formulaire du site. Quand vous y inscrivez votre adresse, trois informations sont enregistrées :',
          {
            tableau: {
              entetes: ['Donnée', 'Pourquoi', 'Combien de temps'],
              lignes: [
                ['Votre adresse e-mail', 'Vous envoyer un e-mail de confirmation au moment de l’inscription, puis un message le jour où CarClan sort, et rien d’autre.', 'Jusqu’à ce que le site devienne la vitrine de l’application sortie, et au plus tard le 31 décembre 2027.'],
                ['La date de votre inscription', 'Prouver quand le consentement a été donné, comme le RGPD l’exige.', 'Idem.'],
                ['La version de cette politique', 'Savoir quel texte vous aviez sous les yeux au moment de vous inscrire.', 'Idem.'],
              ],
            },
          },
          'Si vous vous êtes inscrit avant le 28 septembre 2026 à 16 h 30, votre adresse suit la durée qui vous avait été annoncée : jusqu’à la sortie de l’application, puis trois mois au plus.',
          'Au terme de cette durée, la liste ne s’efface pas d’elle-même : aucun effacement automatique n’est programmé, c’est l’éditeur qui la supprime lui-même. Juste avant, il en tire un export qui sert à une seule chose : mesurer quand et d’où sont venues les inscriptions. Cet export n’est transmis à personne, ne sert à écrire à personne, et il est supprimé une fois cette mesure faite.',
          '**La base légale est votre consentement** : vous saisissez votre adresse vous-même, sous un texte qui dit à quoi elle sert. Vous pouvez le retirer à tout moment en écrivant à l’adresse de contact, ce qui entraîne l’effacement de votre adresse.',
          'Ces adresses sont enregistrées dans une base exploitée par **Supabase** (Supabase Pte. Ltd, Singapour), sur des serveurs situés à Francfort, dans l’Union européenne, et ne sont lues que par l’éditeur. Les deux e-mails sont envoyés par **Resend** (Plus Five Five, Inc., États-Unis), qui reçoit pour cela votre adresse, le message et des données techniques d’envoi, et traite l’essentiel de ses données aux États-Unis. Ces transferts hors de l’Union sont détaillés [plus bas](#transferts-hors-de-l-union-europeenne). Votre adresse n’est jamais revendue, ni transmise à un annonceur, ni utilisée pour une lettre d’information.',
          'Le formulaire porte un champ caché que seul un robot remplit. Sa valeur n’est jamais enregistrée : elle sert uniquement à écarter les envois automatiques.',
        ],
      },
      {
        titre: 'La page publique d’un rassemblement',
        blocs: [
          'Une adresse de la forme carclan.fr/rasso/… ou carclan.fr/r/… affiche la fiche d’un rassemblement publié dans l’application. Cette page **lit** des informations, elle n’en enregistre aucune : ni compte, ni cookie, ni relevé de visite.',
          `Elle montre le type, le titre, la date, le lieu, l’organisateur, la description, l’affiche, le tarif et le lien éventuel vers le site de l’organisateur, ainsi que le nombre d’inscrits et la note moyenne. **Elle ne montre jamais la liste ni les noms des inscrits.** Un organisateur nommé sur une fiche peut demander la modification ou le retrait de son nom à [${CONTACT}](mailto:${CONTACT}).`,
          'Le bouton « Y aller » ouvre Google Maps avec les coordonnées du lieu. Si vous l’utilisez, c’est Google qui reçoit alors votre demande, selon ses propres règles.',
        ],
      },
      {
        titre: 'Les e-mails que vous nous envoyez',
        blocs: [
          `Quand vous écrivez à [${CONTACT}](mailto:${CONTACT}), directement ou en répondant à l’e-mail de confirmation de la liste d’attente, nous recevons votre adresse, votre nom s’il apparaît, et le contenu de votre message.`,
          'Ces messages ne servent qu’à vous répondre et à suivre votre demande : une question, un partenariat, un rassemblement à publier, l’exercice de vos droits ou une inscription à la main sur la liste d’attente. Cela relève de notre intérêt légitime à répondre à qui nous écrit, et de nos obligations légales quand vous exercez vos droits. Une inscription à la liste d’attente demandée par e-mail repose, comme celle du formulaire, sur votre consentement.',
          'Cette boîte est hébergée par **OVH** (OVH SAS, France). Vos messages y restent le temps de traiter votre demande et d’en garder la trace. Nous ne vous annonçons pas de durée maximale : aucun effacement n’y est programmé, et un délai écrit ici serait une promesse que rien ne tient encore. Vous pouvez demander à tout moment l’effacement de vos messages, à la même adresse.',
        ],
      },
      {
        titre: 'Ce qui est enregistré sans que nous le demandions',
        blocs: [
          'Comme tout site, carclan.fr laisse des traces techniques chez ses prestataires :',
          {
            liste: [
              '**GitHub**, qui sert les pages, enregistre l’adresse IP de chaque visiteur, pour la sécurité de son service.',
              '**Supabase**, quand vous envoyez le formulaire ou qu’une page publique de rassemblement est consultée, tient des journaux techniques qui contiennent une adresse IP et, si l’inscription ou l’envoi de l’e-mail de confirmation échoue, parfois l’adresse e-mail saisie.',
            ],
          },
          'Ces traces servent à faire fonctionner le site et à le protéger des abus, ce qui relève de l’intérêt légitime de ces prestataires comme du nôtre. Leur durée de conservation est celle que fixe chacun d’eux, selon ses propres règles : nous ne les effaçons pas nous-mêmes. Nous ne les copions nulle part, et ne nous en servons que pour diagnostiquer une panne.',
          'Nous n’établissons aucun profil, nous ne croisons aucune de ces traces, et nous n’avons aucun moyen de savoir qui visite ce site.',
        ],
      },
      {
        titre: 'Transferts hors de l’Union européenne',
        blocs: [
          'La liste d’attente est enregistrée dans l’Union européenne, à Francfort. Trois prestataires de ce site sont pourtant établis hors de l’Union, et peuvent traiter vos données, ou y accéder, depuis l’étranger :',
          {
            liste: [
              '**Resend** (Plus Five Five, Inc., San Francisco, États-Unis) reçoit votre adresse et le message pour envoyer les e-mails de la liste d’attente, et traite l’essentiel de ses données aux États-Unis. Son accord de traitement des données reprend les clauses contractuelles types de la Commission européenne, et indique que Resend est certifiée au cadre de protection des données UE-États-Unis (Data Privacy Framework), reconnu par une décision d’adéquation de la Commission européenne du 10 juillet 2023 : [resend.com/legal/dpa](https://resend.com/legal/dpa).',
              '**Supabase** (Supabase Pte. Ltd, Singapour) exploite la base de données. Vos données y sont stockées à Francfort, mais son accord de traitement des données lui permet de les traiter partout où elle-même ou ses sous-traitants disposent d’installations. Singapour ne bénéficiant d’aucune décision d’adéquation, ce transfert est encadré par les clauses contractuelles types de la Commission européenne (décision 2021/914), intégrées à cet accord : [supabase.com/legal/dpa](https://supabase.com/legal/dpa).',
              '**GitHub** (GitHub, Inc., San Francisco, États-Unis) sert les pages de ce site et enregistre l’adresse IP des visiteurs, pour la sécurité de son service. Elle traite ses données dans plusieurs pays, dont les États-Unis. [Sa déclaration de confidentialité](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) indique qu’elle est certifiée au Data Privacy Framework, et qu’elle s’appuie aussi sur les clauses contractuelles types.',
            ],
          },
          `Pour obtenir une copie de ces garanties, écrivez à [${CONTACT}](mailto:${CONTACT}).`,
        ],
      },
      {
        titre: 'Vos droits',
        blocs: [
          'Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité sur les données que nous détenons à votre sujet : votre adresse si vous l’avez inscrite sur la liste d’attente, et vos messages si vous nous avez écrit.',
          `Pour les exercer, écrivez à [${CONTACT}](mailto:${CONTACT}). Réponse sous un mois. Aucune justification n’est nécessaire pour demander l’effacement de votre adresse.`,
          'Vous pouvez aussi définir des directives sur la conservation, l’effacement et la communication de vos données après votre décès, et nous les adresser à la même adresse.',
          'Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la Commission nationale de l’informatique et des libertés, [cnil.fr](https://www.cnil.fr).',
        ],
      },
      {
        titre: 'L’âge minimum',
        blocs: [
          'CarClan est réservée aux personnes de **15 ans et plus**, âge du consentement numérique en France. En vous inscrivant à la liste d’attente, vous déclarez avoir cet âge.',
        ],
      },
      {
        titre: 'Modifications de cette page',
        blocs: [
          'La date en haut de cette page indique la version en vigueur. Si ce que le site collecte devait changer, cette page serait mise à jour **avant** que le changement prenne effet.',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------- CGU
  {
    chemin: 'cgu',
    titre: 'Conditions d’utilisation',
    version: SITE_VERSION,
    description: 'Les conditions d’utilisation du site carclan.fr, suivies des conditions générales d’utilisation de l’application CarClan.',
    chapeau: 'Cette page couvre **deux choses distinctes** : l’utilisation du site carclan.fr, puis les conditions générales de l’application CarClan, qui s’appliquent dès que vous y créez un compte.',
    app: 'terms',
    appTitre: 'L’application CarClan',
    sections: [
      {
        titre: 'Le site carclan.fr',
        blocs: [
          `Le site carclan.fr est édité par **${EDITEUR}** (voir les [mentions légales](/mentions-legales/)). Il présente l’application CarClan, permet de s’inscrire à une liste d’attente, et affiche la page publique des rassemblements publiés dans l’application.`,
          'Le consulter est libre et gratuit. Vous vous engagez à ne pas en perturber le fonctionnement, à ne pas tenter d’accéder à des parties non publiques, et à ne pas réutiliser son contenu sans accord écrit.',
        ],
      },
      {
        titre: 'Aucun paiement, donc aucun remboursement',
        blocs: [
          {
            encadre: [
              '**CarClan n’encaisse rien.** Ni le site, ni l’application ne vendent de produit, de billet ou d’abonnement, et aucun paiement n’y transite. Il n’existe donc ni facturation, ni droit de rétractation, ni politique de remboursement à faire valoir.',
            ],
          },
          'Quand la fiche d’un rassemblement indique un tarif, ce montant est celui annoncé par son organisateur, à régler auprès de lui, hors de CarClan. Un lien externe présent sur une fiche mène au site de cet organisateur : ce qui s’y passe ne relève plus de nous.',
          'Si un jour un service payant apparaissait, ces conditions seraient modifiées au préalable, et les informations exigées par le code de la consommation y figureraient.',
        ],
      },
      {
        titre: 'La liste d’attente',
        blocs: [
          'Inscrire votre adresse vous engage à une seule chose : qu’elle soit bien la vôtre. Elle ne servira qu’à vous prévenir de la sortie de l’application, et vous pouvez demander son effacement à tout moment. La [politique de confidentialité](/confidentialite/) le détaille.',
        ],
      },
      {
        titre: 'Disponibilité',
        blocs: [
          'Le site est fourni en l’état. Il peut être interrompu, modifié ou retiré sans préavis, notamment pour maintenance. L’éditeur ne garantit ni l’absence d’interruption, ni l’absence d’erreur.',
          'L’application CarClan est en préparation. Les fonctionnalités présentées sur ce site décrivent son état d’avancement et peuvent évoluer avant sa publication.',
        ],
      },
      {
        titre: 'Droit applicable',
        blocs: [
          'Ces conditions sont soumises au droit français. En cas de litige, et faute de solution amiable, les tribunaux français sont compétents.',
          `Pour toute question sur ces conditions, écrivez à [${CONTACT}](mailto:${CONTACT}).`,
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Cookies
  {
    chemin: 'cookies',
    titre: 'Cookies',
    version: SITE_VERSION,
    description: 'Le site carclan.fr ne dépose aucun cookie et n’utilise aucun traceur. Cette page explique pourquoi il n’y a donc pas de bandeau de consentement.',
    chapeau: 'La réponse courte tient en une ligne : **ce site ne dépose aucun cookie.** Cette page dit ce qui a été vérifié, et pourquoi vous ne voyez pas de bandeau de consentement.',
    sections: [
      {
        titre: 'Aucun cookie, aucun traceur',
        blocs: [
          {
            encadre: [
              'Vérifié le 21 septembre 2026, dans le code du site et sur le site en ligne : **aucun cookie n’est déposé**, aucun identifiant n’est écrit dans votre navigateur, et aucun outil de mesure d’audience n’est installé.',
            ],
          },
          'Concrètement, ce site n’utilise ni cookie, ni stockage local, ni session, ni pixel invisible, ni empreinte de navigateur. Il n’y a ni Google Analytics, ni Meta Pixel, ni aucun équivalent. Les polices de caractères sont servies depuis carclan.fr même, et non depuis un service tiers qui verrait passer votre visite.',
        ],
      },
      {
        titre: 'Pourquoi il n’y a pas de bandeau',
        blocs: [
          'Un bandeau de consentement n’est pas une politesse : c’est une obligation qui naît **quand un site dépose des traceurs non nécessaires**. C’est l’article 82 de la loi Informatique et Libertés, précisé par les lignes directrices de la CNIL de septembre 2020.',
          'Comme ce site n’en dépose aucun, il n’y a rien à consentir. Afficher un bandeau ici reviendrait à vous demander l’autorisation pour quelque chose qui n’existe pas, et à vous faire cliquer pour rien. Nous avons préféré cette page.',
        ],
      },
      {
        titre: 'Les seules requêtes qui sortent',
        blocs: [
          'Trois cas, et aucun ne dépose quoi que ce soit dans votre navigateur :',
          {
            liste: [
              '**Quand vous envoyez le formulaire** de la liste d’attente, votre adresse part chez Supabase, qui l’enregistre à Francfort, puis chez Resend, qui vous envoie l’e-mail de confirmation. C’est ce que vous demandez en cliquant.',
              '**Sur la page publique d’un rassemblement**, la fiche et son affiche sont lues chez Supabase pour être affichées. Rien n’est écrit dans votre navigateur.',
              '**Si vous cliquez sur « Y aller »**, Google Maps s’ouvre avec les coordonnées du lieu. Ce que fait Google ensuite relève de ses propres règles.',
            ],
          },
        ],
      },
      {
        titre: 'Ce qui garantit que ça reste vrai',
        blocs: [
          'Une page qui promet l’absence de traceur vieillit mal : il suffit qu’un outil soit ajouté un jour pour qu’elle devienne un mensonge, sans que personne s’en aperçoive.',
          '**Le site est donc construit avec une vérification automatique** qui inspecte les fichiers produits et refuse de les publier si elle y trouve un cookie, un stockage de navigateur ou l’adresse d’un service de mesure d’audience connu. Tant que cette page existe sous cette forme, cette vérification est passée.',
          'Si ce site devait un jour utiliser un traceur, cette page serait réécrite et votre consentement vous serait demandé **avant** qu’il soit déposé.',
        ],
      },
      {
        titre: 'Et l’application ?',
        blocs: [
          'L’application CarClan n’utilise ni cookie, ni outil publicitaire, ni outil de mesure d’audience tiers. Elle garde en revanche sur votre appareil votre session de connexion, un cache du fond de carte, la dernière liste des événements publics reçue, pour vous les montrer sans réseau, et, le temps d’un envoi, une copie des photos que vous choisissez. La [politique de confidentialité](/confidentialite/) le détaille dans sa section « Ce qui reste sur votre téléphone ».',
        ],
      },
    ],
  },
];
