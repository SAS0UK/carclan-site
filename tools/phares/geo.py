# Les outils communs des phares de la carte du haut : lire les tuiles
# vectorielles d'OpenFreeMap (celles qui ont dessiné la carte), et projeter
# un point du monde dans une image rendue par MapLibre, caméra inclinée.
#
# Python 3 et numpy seulement. Les tuiles se téléchargent par curl (le Python
# de python.org n'a pas les certificats du Mac).

import glob
import json
import math
import os
import subprocess

import numpy as np

TILEJSON = 'https://tiles.openfreemap.org/planet'

# ---- Les tuiles vectorielles (format MVT) -------------------------------------------


def _varint(b, i):
    r = s = 0
    while True:
        c = b[i]
        i += 1
        r |= (c & 0x7F) << s
        s += 7
        if c < 0x80:
            return r, i


def _champs(b):
    i = 0
    while i < len(b):
        k, i = _varint(b, i)
        f, w = k >> 3, k & 7
        if w == 0:
            v, i = _varint(b, i)
        elif w == 2:
            n, i = _varint(b, i)
            v = b[i:i + n]
            i += n
        elif w == 1:
            v = b[i:i + 8]
            i += 8
        elif w == 5:
            v = b[i:i + 4]
            i += 4
        else:
            raise ValueError(w)
        yield f, w, v


def _emballe(b):
    out, i = [], 0
    while i < len(b):
        v, i = _varint(b, i)
        out.append(v)
    return out


def _valeur(b):
    import struct
    for f, _, v in _champs(b):
        if f == 1:
            return v.decode()
        if f == 2:
            return struct.unpack('<f', v)[0]
        if f == 3:
            return struct.unpack('<d', v)[0]
        if f in (4, 5):
            return v
        if f == 6:
            return (v >> 1) ^ -(v & 1)
        if f == 7:
            return bool(v)


def couches(b):
    """Les couches d'une tuile : nom, étendue, [(propriétés, type, géométrie)]."""
    for f, _, v in _champs(b):
        if f != 3:
            continue
        nom, cles, vals, objets, etendue = None, [], [], [], 4096
        for g, _, w in _champs(v):
            if g == 1:
                nom = w.decode()
            elif g == 3:
                cles.append(w.decode())
            elif g == 4:
                vals.append(_valeur(w))
            elif g == 5:
                etendue = w
            elif g == 2:
                objets.append(w)
        sortie = []
        for ob in objets:
            tags, geom, typ = [], [], 0
            for g, _, w in _champs(ob):
                if g == 2:
                    tags = _emballe(w)
                elif g == 3:
                    typ = w
                elif g == 4:
                    geom = _emballe(w)
            props = {cles[tags[j]]: vals[tags[j + 1]] for j in range(0, len(tags), 2)}
            sortie.append((props, typ, geom))
        yield nom, etendue, sortie


def lignes(geom):
    """Les lignes d'une géométrie MVT, en pixels de tuile."""
    x = y = 0
    i, cur, res = 0, [], []
    zz = lambda v: (v >> 1) ^ -(v & 1)
    while i < len(geom):
        c = geom[i]
        i += 1
        cmd, n = c & 7, c >> 3
        if cmd == 1:
            for _ in range(n):
                if cur:
                    res.append(cur)
                x += zz(geom[i])
                y += zz(geom[i + 1])
                i += 2
                cur = [(x, y)]
        elif cmd == 2:
            for _ in range(n):
                x += zz(geom[i])
                y += zz(geom[i + 1])
                i += 2
                cur.append((x, y))
    if cur:
        res.append(cur)
    return res


def couper(l, ext):
    """Une ligne coupée au carré de sa tuile (0 à ext), en morceaux : les tuiles
    débordent sur leurs voisines, et sans ça chaque route serait en double."""
    out, cur = [], []
    for (x0, y0), (x1, y1) in zip(l[:-1], l[1:]):
        dx, dy = x1 - x0, y1 - y0
        t0, t1, ok = 0.0, 1.0, True
        for p, q in ((-dx, x0), (dx, ext - x0), (-dy, y0), (dy, ext - y0)):
            if p == 0:
                if q < 0:
                    ok = False
                    break
            else:
                r = q / p
                if p < 0:
                    t0 = max(t0, r)
                else:
                    t1 = min(t1, r)
        if not ok or t0 > t1:
            if len(cur) > 1:
                out.append(cur)
            cur = []
            continue
        a = (x0 + dx * t0, y0 + dy * t0)
        b = (x0 + dx * t1, y0 + dy * t1)
        if cur and math.hypot(cur[-1][0] - a[0], cur[-1][1] - a[1]) < 1e-6:
            cur.append(b)
        else:
            if len(cur) > 1:
                out.append(cur)
            cur = [a, b]
        if t1 < 1:
            out.append(cur)
            cur = []
    if len(cur) > 1:
        out.append(cur)
    return out


def tuile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def telecharger(z, sud, ouest, nord, est, dossier):
    """Les tuiles qui couvrent la zone, gardées dans `dossier`."""
    os.makedirs(dossier, exist_ok=True)
    gabarit = json.loads(subprocess.run(['curl', '-sSf', TILEJSON], capture_output=True, check=True).stdout)['tiles'][0]
    xa, ya = tuile(ouest, nord, z)
    xb, yb = tuile(est, sud, z)
    for tx in range(int(xa), int(xb) + 1):
        for ty in range(int(ya), int(yb) + 1):
            p = f'{dossier}/{z}-{tx}-{ty}.pbf'
            if not os.path.exists(p):
                url = gabarit.replace('{z}', str(z)).replace('{x}', str(tx)).replace('{y}', str(ty))
                subprocess.run(['curl', '-sSf', '-m', '30', '--compressed', '-o', p, url], check=True)


def routes(dossier, classes, rampes=False):
    """Les routes des tuiles de `dossier`, en coordonnées du monde (0 à 1),
    coupées au bord de leur tuile, dans le sens où l'on y roule. Une route à
    double sens sur une seule ligne est rendue deux fois, une par sens."""
    out = []
    for p in glob.glob(f'{dossier}/*.pbf'):
        z, tx, ty = map(int, os.path.basename(p)[:-4].split('-'))
        n = 2 ** z
        for nom, ext, objets in couches(open(p, 'rb').read()):
            if nom != 'transportation':
                continue
            for props, typ, geom in objets:
                if typ != 2 or props.get('class') not in classes or (props.get('ramp') and not rampes):
                    continue
                sens = props.get('oneway')
                for l in lignes(geom):
                    for m in couper(l, ext):
                        if sens == -1:
                            m = m[::-1]
                        pts = [((tx + x / ext) / n, (ty + y / ext) / n) for x, y in m]
                        out.append({'classe': props.get('class'), 'pts': pts})
                        if sens not in (1, -1):
                            out.append({'classe': props.get('class'), 'pts': pts[::-1]})
    return out


# ---- La caméra -----------------------------------------------------------------------


def projeter(cam, monde, W, H):
    """Des points du monde (0 à 1, Mercator) dans une image de W × H pixels
    rendue par MapLibre : caméra au-dessus de `centre_monde`, tournée de
    `cap` degrés, inclinée de `inclinaison`, champ vertical `champ` degrés.
    Renvoie les pixels et la profondeur (négative = derrière la caméra)."""
    cx, cy = cam['centre_monde']
    echelle = 512 * 2 ** cam['zoom_interne'] * (W / 1440)
    d = (np.asarray(monde) - np.array([cx, cy])) * echelle
    b = math.radians(cam['cap'])
    X = d[:, 0] * math.cos(b) + d[:, 1] * math.sin(b)
    Y = -d[:, 0] * math.sin(b) + d[:, 1] * math.cos(b)
    p = math.radians(cam['inclinaison'])
    D = 0.5 * H / math.tan(math.radians(cam['champ']) / 2)
    prof = D - Y * math.sin(p)
    return np.c_[W / 2 + D * X / prof, H / 2 + D * Y * math.cos(p) / prof], prof


def nelder_mead(f, x0, pas, iterations=800):
    n = len(x0)
    simp = [np.array(x0, float)] + [np.array(x0, float) + np.eye(n)[i] * pas[i] for i in range(n)]
    vals = [f(x) for x in simp]
    for _ in range(iterations):
        o = np.argsort(vals)
        simp, vals = [simp[i] for i in o], [vals[i] for i in o]
        c = np.mean(simp[:-1], 0)
        r = c + (c - simp[-1])
        fr = f(r)
        if fr < vals[0]:
            e = c + 2 * (c - simp[-1])
            fe = f(e)
            simp[-1], vals[-1] = (e, fe) if fe < fr else (r, fr)
        elif fr < vals[-2]:
            simp[-1], vals[-1] = r, fr
        else:
            k = c + 0.5 * (simp[-1] - c)
            fk = f(k)
            if fk < vals[-1]:
                simp[-1], vals[-1] = k, fk
            else:
                simp = [simp[0]] + [simp[0] + 0.5 * (s - simp[0]) for s in simp[1:]]
                vals = [vals[0]] + [f(s) for s in simp[1:]]
    i = int(np.argmin(vals))
    return simp[i], vals[i]
