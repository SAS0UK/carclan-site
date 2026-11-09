#!/usr/bin/env bash
# Construit le site et pousse dist/ sur la branche gh-pages, que GitHub Pages
# sert sous carclan.fr (fichier CNAME inclus par Vite depuis public/).
# Le jeton gh n'a pas le droit d'écrire des workflows Actions, d'où ce chemin.
set -euo pipefail
cd "$(dirname "$0")/.."

# La garde (SITE-9) : `git push -f` sur gh-pages remplace tout le site publié.
# On ne publie que depuis `main` et un arbre propre : jamais une branche de
# travail, ni des changements pas encore commités, ni le dépôt voisin
# `~/DEV/carclan-site` (autre branche).
BRANCHE=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCHE" != "main" ]; then
  echo "refus : la branche est « $BRANCHE », la publication part de main." >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "refus : l'arbre n'est pas propre (git status). Commitez ou écartez d'abord." >&2
  exit 1
fi

# SITE-10 : le déploiement génère les pages de rasso pré-rendues (aperçu
# WhatsApp/Facebook sur /rasso/<id>). Elles ne sont pas mises à jour toutes
# seules : une fiche annulée ou changée reste servie jusqu'au déploiement
# suivant, d'où le redéploiement planifié (marche-finale.md, étape du site).
# Si la base ne répond pas, le build échoue et rien n'est publié.
RASSO_PAGES=1 npm run build
cd dist
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="Mathys" -c user.email="mathys.lienart@gmail.com" commit -q -m "deploy $(date '+%Y-%m-%d %H:%M')"
git push -q -f https://github.com/SAS0UK/carclan-site.git gh-pages:gh-pages
cd .. && rm -rf dist/.git
echo "déployé sur gh-pages"

# IndexNow : on POUSSE les URL aux moteurs au lieu d'attendre leur passage.
# Bing, Yandex, Seznam et Naver le lisent ; Google ne l'utilise pas, c'est la
# Search Console qui fait ce travail de son côté. La clé est publique par
# construction : elle ne prouve que la propriété du domaine, via le fichier
# du même nom servi à la racine.
# La clé est nommée ici, pas devinée dans public/ : un second fichier .txt
# aurait pu la remplacer sans bruit. Elle doit exister au même nom.
CLE=fd51d69d8c3432250fce5ca682ae40cc
[ -f "public/$CLE.txt" ] || CLE=""
if [ -n "$CLE" ]; then
  curl -fsS -X POST "https://api.indexnow.org/IndexNow" \
    -H "Content-Type: application/json" \
    -d "{\"host\":\"carclan.fr\",\"key\":\"$CLE\",\"keyLocation\":\"https://carclan.fr/$CLE.txt\",\"urlList\":[\"https://carclan.fr/\",\"https://carclan.fr/mentions-legales/\",\"https://carclan.fr/confidentialite/\",\"https://carclan.fr/cgu/\",\"https://carclan.fr/cookies/\"]}" \
    >/dev/null && echo "IndexNow prévenu (clé $CLE)" || echo "IndexNow injoignable, sans conséquence"
fi
