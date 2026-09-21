#!/usr/bin/env bash
# Construit le site et pousse dist/ sur la branche gh-pages, que GitHub Pages
# sert sous carclan.fr (fichier CNAME inclus par Vite depuis public/).
# Le jeton gh n'a pas le droit d'écrire des workflows Actions, d'où ce chemin.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
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
CLE=$(basename "$(ls public/*.txt 2>/dev/null | head -1)" .txt || true)
if [ -n "${CLE:-}" ] && [ "$CLE" != "llms" ] && [ "$CLE" != "robots" ]; then
  curl -fsS -X POST "https://api.indexnow.org/IndexNow" \
    -H "Content-Type: application/json" \
    -d "{\"host\":\"carclan.fr\",\"key\":\"$CLE\",\"keyLocation\":\"https://carclan.fr/$CLE.txt\",\"urlList\":[\"https://carclan.fr/\",\"https://carclan.fr/mentions-legales/\",\"https://carclan.fr/confidentialite/\",\"https://carclan.fr/cgu/\",\"https://carclan.fr/cookies/\"]}" \
    >/dev/null && echo "IndexNow prévenu (clé $CLE)" || echo "IndexNow injoignable, sans conséquence"
fi
