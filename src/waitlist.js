// Liste d'attente : une insertion REST dans public.waitlist (migration 0046 du
// dépôt CarClan). La clé publiable est publique par construction : la table
// n'accepte que l'insertion de trois colonnes, sans lecture ni modification.
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
  echec: 'Impossible d’enregistrer pour le moment. Écrivez à contact@carclan.fr, on vous ajoute à la main.',
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
const CONFIRMATION = {
  fait: { titre: 'C’est noté.', detail: (email) => (email ? `On écrit à ${email} le jour de la sortie.` : 'On vous écrit le jour de la sortie.') },
  deja: { titre: 'Vous y êtes déjà.', detail: (email) => (email ? `${email} est sur la liste depuis un moment. À bientôt.` : 'Cette adresse est déjà sur la liste. À bientôt.') },
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

// Le chemin d'avant la fonction Edge, gardé comme filet. `waitlist` n'accepte
// que l'insertion de trois colonnes sous RLS : la clé publiable ne donne rien
// de plus ici que ce que le formulaire donne déjà.
async function inscrireEnDirect(email, signal) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: 'POST',
      signal,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email, source: 'site', consent_version: CONSENT_VERSION }),
    });
    return res.status === 201 || res.status === 204 || res.status === 409;
  } catch {
    return false;
  }
}

export function setupWaitlist(form) {
  if (!form) return;
  const champ = form.querySelector('input[type="email"]');
  const potDeMiel = form.querySelector('input[name="website"]');
  const etat = form.querySelector('.etat-envoi');
  const bouton = form.querySelector('button[type="submit"]');
  if (!champ || !etat || !bouton) return;

  const bloc = form.closest('.bloc');
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
    const minuteur = setTimeout(() => controleur.abort(), 9000);

    try {
      // Voie normale : la fonction `waitlist` inscrit ET envoie l'accusé de
      // réception. Elle seule détient la clé Resend, qui ne peut pas vivre ici.
      const res = await fetch(`${SUPABASE_URL}/functions/v1/waitlist`, {
        method: 'POST',
        signal: controleur.signal,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          source: 'site',
          consent_version: CONSENT_VERSION,
          website: potDeMiel ? potDeMiel.value : '',
        }),
      });

      const etatRendu = res.ok ? (await res.json().catch(() => ({}))).etat : null;

      if (etatRendu === 'fait' || etatRendu === 'deja') {
        conclure(etatRendu, email);
      } else if (await inscrireEnDirect(email, controleur.signal)) {
        // Repli : la fonction est injoignable ou en panne. L'insertion directe
        // marche toujours, elle ne perd simplement pas l'adresse pour un
        // message qui n'est pas parti. Mieux vaut un inscrit sans accusé de
        // réception qu'un formulaire qui refuse.
        conclure('fait', email);
      } else {
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
