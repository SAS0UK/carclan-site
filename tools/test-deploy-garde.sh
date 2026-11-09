#!/usr/bin/env bash
# Banc de la garde de tools/deploy.sh (SITE-9) : dans un dépôt jetable, avec un
# faux `npm` qui note son appel, le script doit refuser hors `main` et sur un
# arbre sale AVANT de construire quoi que ce soit.
# Usage : bash tools/test-deploy-garde.sh [chemin de deploy.sh]
set -u
SCRIPT="$(cd "$(dirname "${1:-$(dirname "$0")/deploy.sh}")" && pwd)/$(basename "${1:-deploy.sh}")"
T=$(mktemp -d); mkdir -p "$T/bin" "$T/depot/tools"
printf '#!/bin/sh\ntouch "%s/npm-appele"\nexit 1\n' "$T" > "$T/bin/npm"; chmod +x "$T/bin/npm"
cp "$SCRIPT" "$T/depot/tools/deploy.sh"
cd "$T/depot"
git init -q -b main; git config user.email t@t; git config user.name t
echo a > f; git add -A; git commit -q -m init
echec=0
essai() { # nom, attendu (refus|passe)
  rm -f "$T/npm-appele"
  PATH="$T/bin:$PATH" bash tools/deploy.sh >"$T/sortie" 2>&1
  if [ "$2" = refus ] && [ ! -e "$T/npm-appele" ]; then echo "ok $1"
  elif [ "$2" = passe ] && [ -e "$T/npm-appele" ]; then echo "ok $1"
  else echo "ECHEC $1"; echec=1; fi
}
git checkout -q -b autre; essai "hors main : refusé avant le build" refus
git checkout -q main; echo b >> f; essai "arbre sale : refusé avant le build" refus
git checkout -q -- f; essai "main propre : le build démarre" passe
exit $echec
