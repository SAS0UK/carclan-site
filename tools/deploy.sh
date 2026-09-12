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
