// Les textes juridiques propres au site carclan.fr.
//
// Règle de rédaction, la même que pour les documents de l'application :
// ne rien écrire que le code ne fasse. Chaque phrase sur les données
// correspond à une requête réellement émise par ce site, vérifiée le
// 21 septembre 2026 dans `src/waitlist.js`, `public/404.html` et sur le site
// en ligne (`curl -I https://carclan.fr` : aucun `Set-Cookie`).
//
// Les textes de l'application ne sont pas ici : ils sont extraits du code de
// CarClan par `tools/sync-legal.dart` et repris mot pour mot par
// `tools/build-legal.mjs`.
//
// Balisage accepté dans les chaînes : **gras** et [texte](adresse).

export const SITE_VERSION = '21 septembre 2026';

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
              'CarClan est aujourd’hui un projet personnel, sans activité commerciale et sans société. L’éditeur agit donc à titre non professionnel, au sens de l’article 6-III-2 de la loi du 21 juin 2004 pour la confiance dans l’économie numérique, ce qui lui permet de ne pas publier son adresse postale complète. Son identité est en revanche connue de l’hébergeur du site. Dès qu’une structure sera immatriculée, cette page portera sa dénomination, son adresse, son numéro SIREN et, le cas échéant, son numéro de TVA.',
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
          'Ce service se limite à servir des fichiers : il ne reçoit ni compte, ni mot de passe, ni contenu que vous saisiriez sur ce site.',
        ],
      },
      {
        titre: 'Hébergement des données',
        blocs: [
          'Les données que ce site enregistre, c’est-à-dire les adresses de la liste d’attente, et celles de l’application CarClan sont hébergées par :',
          {
            defs: [
              ['Supabase, Inc.', 'Base de données, authentification et stockage des fichiers, sur des serveurs Amazon Web Services situés à Francfort, en Allemagne, dans l’Union européenne.'],
              ['Resend', 'Envoi des courriels liés à un compte de l’application. Serveurs situés en Irlande, dans l’Union européenne.'],
            ],
          },
          'La [politique de confidentialité](/confidentialite/) détaille ce qui est collecté, pourquoi et pendant combien de temps.',
        ],
      },
      {
        titre: 'Propriété intellectuelle',
        blocs: [
          'Le nom CarClan, le logo, l’identité visuelle, les textes, les visuels de ce site et le code de l’application appartiennent à l’éditeur. Ils ne peuvent être copiés, modifiés ou rediffusés sans accord écrit.',
          'Les affiches de rassemblement présentées sur ce site sont des visuels créés pour CarClan. Elles ne reprennent aucune photographie ni aucun modèle appartenant à un tiers.',
          'Les marques et les noms de véhicules éventuellement cités appartiennent à leurs titulaires respectifs et ne sont mentionnés qu’à titre de référence.',
        ],
      },
      {
        titre: 'Crédits',
        blocs: [
          {
            defs: [
              ['Archivo', 'Police de caractères de Omnibus-Type, distribuée sous licence SIL Open Font 1.1. Le texte de la licence est servi à l’adresse [carclan.fr/fonts/OFL-Archivo.txt](/fonts/OFL-Archivo.txt).'],
              ['Décor du site', 'Scène tridimensionnelle écrite pour CarClan avec la bibliothèque three.js (licence MIT). Aucun modèle ni aucune photographie tierce n’y est utilisé.'],
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
              '**Ce site ne dépose aucun cookie, n’utilise aucun traceur et ne mesure pas son audience.** Il n’enregistre qu’une seule chose, et seulement si vous la saisissez vous-même : votre adresse e-mail, pour vous prévenir de la sortie de l’application.',
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
                ['Votre adresse e-mail', 'Vous envoyer un message le jour où CarClan sort, et rien d’autre.', 'Jusqu’à la sortie de l’application, puis trois mois au plus.'],
                ['La date de votre inscription', 'Prouver quand le consentement a été donné, comme le RGPD l’exige.', 'Idem.'],
                ['La version de cette politique', 'Savoir quel texte vous aviez sous les yeux au moment de vous inscrire.', 'Idem.'],
              ],
            },
          },
          '**La base légale est votre consentement** : vous saisissez votre adresse vous-même, sous un texte qui dit à quoi elle sert. Vous pouvez le retirer à tout moment en écrivant à l’adresse de contact, ce qui entraîne l’effacement de votre adresse.',
          'Ces adresses partent chez **Supabase** (serveurs situés à Francfort, dans l’Union européenne) et ne sont lues que par l’éditeur, depuis le tableau de bord de ce service. Elles ne sont jamais revendues, ni transmises à un annonceur, ni utilisées pour une lettre d’information.',
          'Le formulaire porte un champ caché que seul un robot remplit. Sa valeur n’est jamais enregistrée : elle sert uniquement à écarter les envois automatiques.',
        ],
      },
      {
        titre: 'La page publique d’un rassemblement',
        blocs: [
          'Une adresse de la forme carclan.fr/rasso/… ou carclan.fr/r/… affiche la fiche d’un rassemblement publié dans l’application. Cette page **lit** des informations, elle n’en enregistre aucune : ni compte, ni cookie, ni relevé de visite.',
          'Elle montre le titre, la date, le lieu, l’organisateur, la description, l’affiche et le tarif. **Elle ne montre jamais la liste ni les noms des inscrits.**',
          'Le bouton « Y aller » ouvre Google Maps avec les coordonnées du lieu. Si vous l’utilisez, c’est Google qui reçoit alors votre demande, selon ses propres règles.',
        ],
      },
      {
        titre: 'Ce qui est enregistré sans que nous le demandions',
        blocs: [
          'Comme tout site, carclan.fr laisse des traces techniques chez ses prestataires. Nous ne les copions nulle part et ne nous en servons pas :',
          {
            liste: [
              '**GitHub**, qui sert les pages, tient des journaux d’accès contenant notamment une adresse IP, selon ses propres règles de conservation.',
              '**Supabase**, quand vous envoyez le formulaire ou qu’une page publique est consultée, tient de même des journaux techniques.',
            ],
          },
          'Nous n’établissons aucun profil, nous ne croisons aucune de ces traces, et nous n’avons aucun moyen de savoir qui visite ce site.',
        ],
      },
      {
        titre: 'Vos droits',
        blocs: [
          'Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité sur les données que ce site détient, c’est-à-dire votre adresse si vous l’avez inscrite sur la liste d’attente.',
          `Pour les exercer, écrivez à [${CONTACT}](mailto:${CONTACT}). Réponse sous un mois. Aucune justification n’est nécessaire pour demander l’effacement de votre adresse.`,
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
              '**Quand vous envoyez le formulaire** de la liste d’attente, votre adresse part chez Supabase, à Francfort. C’est ce que vous demandez en cliquant.',
              '**Sur la page publique d’un rassemblement**, la fiche est lue chez Supabase pour être affichée. Rien n’est écrit.',
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
          'L’application CarClan n’utilise ni cookie, ni outil publicitaire, ni outil de mesure d’audience tiers. Elle garde en revanche votre session de connexion sur votre appareil, ainsi qu’un cache de la carte. La [politique de confidentialité](/confidentialite/) le détaille dans sa section « Ce qui reste sur votre téléphone ».',
        ],
      },
    ],
  },
];
