# Écrit src/phares-voies.js : les grands axes de la carte du haut, où roulent
# les phares (src/mouvement.js), en dix-millièmes de chaque image.
#
#   python3 tools/phares/voies.py
#
# À relancer si une image de la carte du haut change (après avoir recalé sa
# caméra : tools/phares/caler.py). Les autoroutes et les voies rapides
# (classes « motorway » et « trunk » d'OpenMapTiles), sans les bretelles,
# chaque chaussée dans le sens où l'on y roule, raccordées bout à bout pour
# qu'une lumière passe d'un morceau à l'autre sans s'éteindre, comme dans
# l'app (phares_autoroutes.dart). Un morceau isolé plus court qu'un
# espacement de lumières (200 points) est écarté : il ne ferait que clignoter.

import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from geo import projeter, routes, telecharger  # noqa: E402

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))
TUILES = os.environ.get('TUILES', '/tmp/carclan-tuiles-13')

# Pixels d'image par point CSS, là où l'image est affichée : 1440 points de
# large pour nuit.jpg, 546 pour nuit-portrait.jpg sur un téléphone de 390.
POINTS = {'d': 2880 / 1440, 'p': 1170 / 546}
ESPACEMENT = 200


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.hypot(*ab)
    d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n if n > 0 else np.hypot(*(pts - a).T)
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.array([a, b])


def longueur(l):
    return float(np.sum(np.hypot(*np.diff(l, axis=0).T)))


def direction(l, debut):
    v = l[min(len(l) - 1, 1)] - l[0] if debut else l[-1] - l[max(0, len(l) - 2)]
    n = np.hypot(*v)
    return v / n if n else v


def voies(cam, morceaux, minimum):
    W, H = cam['largeur'], cam['hauteur']
    marge = 0.02
    lignes = []
    for m in morceaux:
        q, prof = projeter(cam, np.array(m), W, H)
        dedans = (prof > 0) & (q[:, 0] > -marge * W) & (q[:, 0] < (1 + marge) * W) & (q[:, 1] > -marge * H) & (q[:, 1] < (1 + marge) * H)
        cur = []
        for k in range(len(q)):
            if dedans[k]:
                cur.append(q[k])
            else:
                if len(cur) > 1:
                    lignes.append(np.array(cur))
                cur = []
        if len(cur) > 1:
            lignes.append(np.array(cur))
    # Les raccords : la fin de l'une sur le début de l'autre, à un pixel
    # près, dans le prolongement (60° au plus : une lumière ne fait jamais
    # demi-tour d'une chaussée à l'autre).
    change = True
    while change:
        change = False
        for i in range(len(lignes)):
            if lignes[i] is None:
                continue
            for j in range(len(lignes)):
                if i == j or lignes[j] is None:
                    continue
                a, b = lignes[i], lignes[j]
                if np.hypot(*(a[-1] - b[0])) < 1.2 and np.dot(direction(a, False), direction(b, True)) > 0.5:
                    lignes[i] = np.vstack([a, b[1:]])
                    lignes[j] = None
                    change = True
                    break
    lignes = sorted((l for l in lignes if l is not None), key=longueur, reverse=True)
    gardees = []
    for l in lignes:
        if longueur(l) < minimum:
            continue
        echant = l[::max(1, len(l) // 12)]
        sens = l[-1] - l[0]
        double = any(
            np.dot(g[-1] - g[0], sens) > 0
            and np.min(np.hypot(*(g[:, None, :] - echant[None, :, :]).transpose(2, 0, 1)), axis=0).max() < 1.0
            for g in gardees
        )
        if not double:
            gardees.append(l)
    print(f"{cam['image']} : {len(gardees)} voies", file=sys.stderr)
    return [rdp(l, 0.7) / [W, H] for l in gardees]


telecharger(13, 50.55, 2.85, 50.82, 3.40, TUILES)
morceaux = [r['pts'] for r in routes(TUILES, {'motorway', 'trunk'})]
cams = json.load(open(f'{ICI}/cameras.json'))
sortie = [
    "// Les grands axes de la carte du haut, là où roulent les phares (mouvement.js).",
    "// Fichier GÉNÉRÉ par tools/phares/voies.py : ne pas le modifier à la main.",
    "//",
    "// Chaque voie est une chaussée d'autoroute ou de voie rapide (classes",
    "// « motorway » et « trunk » d'OpenMapTiles, sans les bretelles), raccordée",
    "// bout à bout dans le sens où l'on y roule. Les points sont en dix-millièmes",
    "// de l'image : x de gauche à droite, y de haut en bas.",
    "// `d` : /carte/nuit.jpg (2880 × 1800), `p` : /carte/nuit-portrait.jpg (1170 × 2532),",
    "// projetées par la caméra retrouvée sur chaque image (tools/phares/cameras.json).",
    "export const VOIES = {",
]
for cle in ('d', 'p'):
    sortie.append(f'  {cle}: [')
    for l in voies(cams[cle], morceaux, ESPACEMENT * POINTS[cle]):
        sortie.append('    [' + ','.join(str(round(float(x) * 10000)) for x in l.ravel()) + '],')
    sortie.append('  ],')
sortie.append('};')
open(f'{RACINE}/src/phares-voies.js', 'w').write('\n'.join(sortie) + '\n')
print('src/phares-voies.js écrit', file=sys.stderr)
