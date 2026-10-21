# Retrouve la caméra qui a rendu une image de la carte du haut.
#
# Les deux images (/carte/nuit.jpg et nuit-portrait.jpg) ont été rendues le
# 27 septembre 2026 par MapLibre, caméra inclinée, et leurs réglages ont été
# perdus avec le bloc-notes de cette session. Ce script les retrouve, le
# 20 octobre 2026 : les autoroutes du style Sodium sont les traits les plus
# clairs de l'image (au-dessus du 98,5e centile), et la caméra est celle qui
# pose les autoroutes d'OpenStreetMap exactement sur eux. Six réglages
# (centre, zoom, cap, inclinaison, champ), ajustés par Nelder-Mead sur
# l'image de plus en plus nette.
#
#   python3 tools/phares/caler.py d      # recale la caméra de nuit.jpg
#   python3 tools/phares/caler.py p      # celle de nuit-portrait.jpg
#   python3 tools/phares/caler.py r      # celle de region.jpg (la carte du bas)
#
# Il part de cameras.json et l'y réécrit. Pour une image refaite de zéro,
# mettre dans cameras.json un départ grossier (cap et inclinaison à 10° près,
# centre à 1 km près) : le calage ne cherche que dans les environs.
# Vérification : l'image de contrôle (autoroutes en bleu par-dessus) dans le
# dossier des tuiles.

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from geo import nelder_mead, projeter, routes, telecharger  # noqa: E402

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))
TUILES = os.environ.get('TUILES', '/tmp/carclan-tuiles')

cle = sys.argv[1]
cams = json.load(open(f'{ICI}/cameras.json'))
cam = cams[cle]
im = Image.open(f"{RACINE}/{cam['image']}").convert('L')
W, H = im.size

z = cam['tuiles']['zoom']
dossier = f'{TUILES}-{z}'
telecharger(z, *cam['tuiles']['zone'], dossier)
autoroutes = [r['pts'] for r in routes(dossier, {'motorway'})]
pts = []
for l in autoroutes:
    l = np.array(l)
    for a, b in zip(l[:-1], l[1:]):
        n = max(1, int(np.hypot(*(b - a)) / (6e-7 * 2 ** (13 - z))))  # ~1 pixel d'image, quel que soit le zoom
        pts.append(a + (b - a) * np.linspace(0, 1, n, endpoint=False)[:, None])
P = np.concatenate(pts)

a = np.array(im, dtype=np.float32)
masque = Image.fromarray(((a > np.percentile(a, 98.5)) * 255).astype(np.uint8))

def vers(v):
    return {**cam, 'centre_monde': [v[0] * 1e-5, v[1] * 1e-5], 'zoom_interne': v[2], 'cap': v[3], 'inclinaison': v[4], 'champ': v[5]}

def score(c, champ):
    q, prof = projeter(c, P, W, H)
    ok = (prof > 0) & (q[:, 0] >= 0) & (q[:, 0] < W - 1) & (q[:, 1] >= 0) & (q[:, 1] < H - 1)
    if ok.sum() < 150:
        return 0
    qi = q[ok].astype(int)
    return champ[qi[:, 1], qi[:, 0]].mean() * min(1, ok.sum() / 2000)

v = np.array([cam['centre_monde'][0] * 1e5, cam['centre_monde'][1] * 1e5, cam['zoom_interne'], cam['cap'], cam['inclinaison'], cam['champ']])
for flou, pas in [(16, 1), (8, 0.5), (4, 0.3), (2, 0.15), (1, 0.08)]:
    champ = np.array(masque.filter(ImageFilter.GaussianBlur(flou)), dtype=np.float32)
    echelles = np.array([1, 1, 0.05, 2, 2, 4]) * pas
    f = lambda x: -score(vers(x), champ)
    v, val = nelder_mead(f, v, echelles, 1200)
    v, val = nelder_mead(f, v, echelles * 0.3, 800)
    print(f'flou {flou} : {-val:.1f} / 255 sur les autoroutes', flush=True)

cams[cle] = vers(v)
json.dump(cams, open(f'{ICI}/cameras.json', 'w'), indent=2)
controle = Image.open(f"{RACINE}/{cam['image']}").convert('RGB')
d = ImageDraw.Draw(controle)
for l in autoroutes:
    q, prof = projeter(cams[cle], np.array(l), W, H)
    if (prof > 0).all():
        d.line([tuple(x) for x in q], fill=(0, 200, 255), width=3)
controle.save(f'{dossier}/controle-{cle}.jpg', quality=82)
print('caméra écrite dans cameras.json ; contrôle :', f'{dossier}/controle-{cle}.jpg')
