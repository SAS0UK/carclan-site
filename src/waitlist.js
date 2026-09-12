// Liste d'attente : une insertion REST dans public.waitlist (migration 0046 du
// dépôt CarClan). La clé publiable est publique par construction : la table
// n'accepte que l'insertion de trois colonnes, sans lecture ni modification.
const SUPABASE_URL = 'https://zheixbgssdfquresgtai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5BXrkwGrcB-YXA2uN5UqAA_mAY3iScd';
export const CONSENT_VERSION = '2026-09-12';

const MESSAGES = {
  invalid: 'Cette adresse ne ressemble pas à une adresse e-mail.',
  sending: 'Un instant…',
  done: 'C’est noté. On vous écrit le jour de la sortie.',
  duplicate: 'Cette adresse est déjà sur la liste. À bientôt.',
  failed: 'Impossible d’enregistrer pour le moment. Écrivez à contact@carclan.fr, on vous ajoute à la main.',
};

const looksLikeEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

export function setupWaitlist(form) {
  if (!form) return;
  const input = form.querySelector('input[type="email"]');
  const honeypot = form.querySelector('input[name="website"]');
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');

  const say = (key, error = false) => {
    status.textContent = MESSAGES[key];
    status.classList.toggle('error', error);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input.value.trim();
    if (honeypot && honeypot.value) {
      form.classList.add('done');
      say('done');
      return;
    }
    if (!looksLikeEmail(email)) {
      say('invalid', true);
      input.focus();
      return;
    }
    button.disabled = true;
    say('sending');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email, source: 'site', consent_version: CONSENT_VERSION }),
      });
      if (res.status === 201 || res.status === 204) {
        form.classList.add('done');
        say('done');
      } else if (res.status === 409) {
        form.classList.add('done');
        say('duplicate');
      } else {
        say('failed', true);
        button.disabled = false;
      }
    } catch {
      say('failed', true);
      button.disabled = false;
    } finally {
      clearTimeout(timer);
    }
  });
}
