// Liste d'attente : la fonction Edge `waitlist`, qui envoie un lien de
// confirmation (double confirmation depuis le build 16, migration 0134 du
// dépôt CarClan). La clé publiable ne sert plus qu'au compteur public.
//
// La version du consentement vient de `legal-version.js`, la même que celle
// affichée en tête de la politique de confidentialité : c'est ce qui permet
// de savoir, plus tard, quel texte la personne avait sous les yeux.
import { CONSENT_VERSION } from './legal-version.js';

const SUPABASE_URL = 'https://zheixbgssdfquresgtai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5BXrkwGrcB-YXA2uN5UqAA_mAY3iScd';

export { CONSENT_VERSION };

const MESSAGES = {
  envoi: 'Un instant…',
  echec: 'Ton adresse n’a pas pu être enregistrée. Écris à contact@carclan.fr, on t’ajoute à la main.',
};

// Un message d'erreur nomme le problème, il ne le constate pas : « cette
// adresse ne ressemble pas à une adresse e-mail » laisse chercher tout seul.
const diagnostic = (v) => {
  if (!v) return 'Il manque l’adresse.';
  if (!v.includes('@')) return 'Il manque le @ : une adresse ressemble à prenom@fai.fr.';
  if (!/\.[^@\s.]+$/.test(v)) return 'Il manque la fin du domaine, par exemple prenom@fai.fr.';
  return 'Cette adresse ne ressemble pas à une adresse e-mail.';
};

// La confirmation rappelle l'adresse enregistrée : c'est la seule façon de
// rattraper une faute de frappe une fois le champ effacé.
// Depuis le build 16 (double confirmation, 3 novembre 2026), la fonction
// répond `fait` dans tous les cas : adresse neuve, déjà inscrite, confirmée ou
// plafonnée. Le site dit donc la seule chose vraie pour toutes : regarde ta
// boîte. Le rappel de l'adresse rattrape une faute de frappe.
const CONFIRMATION = {
  fait: {
    titre: 'Regarde ta boîte mail.',
    detail: (email) =>
      email
        ? `Un lien part vers ${email}. Touche-le pour entrer sur la liste. Rien reçu\u00a0? Regarde dans les indésirables.`
        : 'Un lien vient de partir. Touche-le pour entrer sur la liste.',
  },
};

const ressembleAUnEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

// En dessous de ce nombre, le compteur ne s'affiche pas : « 12 personnes sur
// la liste » dit l'inverse de ce qu'on veut dire. Il se branche tout seul le
// jour où le chiffre devient un argument. C'est la seule valeur à changer.
const SEUIL_COMPTEUR = 50;

// `waitlist_count()` rend le compte arrondi à la dizaine inférieure, jamais
// une ligne : la table n'a aucune policy de lecture et n'en aura pas. L'arrondi
// ferme aussi l'oracle, sinon deux appels encadrant un envoi diraient si
// l'adresse était déjà là.
export async function setupCompteur(el) {
  if (!el) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/waitlist_count`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) return;
    const n = Number(await res.json());
    if (!Number.isFinite(n) || n < SEUIL_COMPTEUR) return;
    el.textContent = `Déjà plus de ${n.toLocaleString('fr-FR')} personnes sur la liste.`;
    el.hidden = false;
  } catch {
    // Le compteur est un supplément : son absence ne casse rien.
  }
}

export function setupWaitlist(form) {
  if (!form) return;
  const champ = form.querySelector('input[type="email"]');
  const potDeMiel = form.querySelector('input[name="website"]');
  const etat = form.querySelector('.etat-envoi');
  const bouton = form.querySelector('button[type="submit"]');
  if (!champ || !etat || !bouton) return;

  // Le bloc porte le formulaire ET sa confirmation. La page en a deux (en
  // haut et en bas) : chacun a le sien, et une inscription les ferme tous
  // les deux (voir main.js, l'événement « attente:fait »).
  const bloc = form.closest('[data-attente]');
  const fait = bloc?.querySelector('.fait');
  const libelle = bouton.querySelector('[data-libelle]');
  const libelleRepos = libelle ? libelle.textContent : '';

  // L'état est annoncé par `aria-live` (voir le gabarit) : il se lit au
  // lecteur d'écran sans déplacer le focus. L'erreur porte une icône en plus
  // de la couleur, la couleur seule ne disant rien à qui ne la voit pas.
  const dire = (texte, erreur = false) => {
    etat.textContent = texte;
    etat.classList.toggle('erreur', erreur);
    champ.setAttribute('aria-invalid', erreur ? 'true' : 'false');
  };

  // Le bouton d'attente garde son ambre et dit ce qu'il fait : voir la règle
  // `.btn-ambre:disabled` dans tokens.css.
  const occupe = (oui) => {
    bouton.disabled = oui;
    if (libelle) libelle.textContent = oui ? 'Envoi…' : libelleRepos;
  };

  // Le dernier écran du parcours. Le bloc cesse de demander quoi que ce soit,
  // et le focus va sur la confirmation : sans ça il retombe sur `body`, le
  // bouton qui le portait venant d'être masqué.
  const conclure = (cle, email) => {
    const { titre, detail } = CONFIRMATION[cle];
    form.classList.add('done');
    bloc?.classList.add('done');
    if (fait) {
      const t = fait.querySelector('[data-fait-titre]');
      if (t) t.textContent = titre;
      fait.hidden = false;
    }
    dire(detail(email));
    fait?.focus();
    document.dispatchEvent(new CustomEvent('attente:fait', { detail: { bloc, cle, email } }));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = champ.value.trim();

    // Le pot de miel : un robot le remplit, une personne ne le voit pas. On
    // ne lui dit pas qu'il est repéré, et rien ne part en base.
    if (potDeMiel && potDeMiel.value) {
      conclure('fait', email);
      return;
    }

    if (!ressembleAUnEmail(email)) {
      dire(diagnostic(email), true);
      champ.focus();
      return;
    }

    occupe(true);
    dire(MESSAGES.envoi);

    const controleur = new AbortController();
    // 15 s : la fonction attend l'envoi du lien de confirmation avant de
    // répondre.
    const minuteur = setTimeout(() => controleur.abort(), 15000);

    try {
      // La fonction `waitlist` inscrit ET envoie le lien de confirmation.
      // Elle seule détient la clé Resend, qui ne peut pas vivre ici.
      // ⚠️ Aucun en-tête `apikey` ni `Authorization` ici : la fonction ne
      // les demande pas (déployée sans vérification de jeton) et son CORS
      // n'autorise que `content-type`. Avec eux, le navigateur refusait la
      // requête au préflight et TOUTE inscription échouait, du 21 au
      // 27 septembre 2026, sans que rien ne le montre côté serveur.
      const res = await fetch(`${SUPABASE_URL}/functions/v1/waitlist`, {
        method: 'POST',
        signal: controleur.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'site',
          consent_version: CONSENT_VERSION,
          website: potDeMiel ? potDeMiel.value : '',
        }),
      });

      const etatRendu = res.ok ? (await res.json().catch(() => ({}))).etat : null;

      if (etatRendu === 'fait') {
        conclure('fait', email);
      } else {
        // Plus de repli par l'insertion directe : la table ne l'accepte plus
        // (0135), et une adresse sans lien de confirmation ne compterait pas.
        dire(MESSAGES.echec, true);
        occupe(false);
      }
    } catch {
      dire(MESSAGES.echec, true);
      occupe(false);
    } finally {
      clearTimeout(minuteur);
    }
  });
}
