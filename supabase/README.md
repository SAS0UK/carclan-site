# Fonctions Edge du site

Une seule : `waitlist` (la liste d'attente de carclan.fr, double confirmation, migration 0134 du dépôt CarClan).

- Déploiement sans vérification de jeton : `supabase/config.toml` (`verify_jwt = false`). Sans lui, aucune inscription ne passe.
- Secrets lus par la fonction (noms seuls, jamais les valeurs ici) : `RESEND_API_KEY`, `WAITLIST_FROM`, `WAITLIST_SEL`, plus `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`, fournis par Supabase.
