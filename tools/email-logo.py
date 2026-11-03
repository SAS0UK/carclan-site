#!/usr/bin/env python3
"""L'image d'en-tete de l'e-mail de la liste d'attente : le Maillon allume
au-dessus d'un sol mouille qui le reflete (piste C de la conversation
logo-carclan du 3 novembre 2026, choisie par Mathys pour l'e-mail).

    python3 tools/email-logo.py MASQUE.png public/email/logo.png

Le masque est le Maillon blanc sur noir, 2048 de cote, le logo en 1560
centre. Il se fait depuis le SVG du site, avec Chrome sans fenetre :

    <img src="public/le-maillon.svg" style="position:absolute;left:244px;
      top:244px;width:1560px;height:1560px;filter:brightness(0) invert(1)">
    dans une page noire de 2048 x 2048, --screenshot.

Un nouveau logo = un nouveau masque, on relance, on republie le site.
L'e-mail ne change pas : il pointe toujours sur /email/logo.png.

Les bords de l'image se fondent EXACTEMENT dans la nuit de l'e-mail
(#0f0e0c) : sans ca, la lueur du mur dessinerait un carre colle sur le fond.
"""

import sys

import numpy as np
from PIL import Image

N = 2048
NUIT = np.array([0x0F, 0x0E, 0x0C]) / 255
AMBRE = np.array([0xE2, 0xA2, 0x1F]) / 255
AMBRE_CHAUD = np.array([0xF2, 0x8A, 0x12]) / 255  # le sodium, plus orange
JAUNE = np.array([0xFF, 0xD0, 0x6A]) / 255  # le coeur du tube, encore ambre
BRIQUE = np.array([0x1E, 0x15, 0x0E]) / 255

# Le cadrage dans le carre de 2048 : le Maillon et son reflet, sans le vide
# autour, mais assez d'air pour que rien ne touche le bord. Puis la largeur de sortie, le double de l'affichage (220 px).
CADRE = (164, 200, 1884, 1920)  # gauche, haut, droite, bas
SORTIE = 440

FIN_REFLET = 0.22  # le reflet est eteint a 22 % de la hauteur sous l'horizon

rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:N, 0:N] / N


def flou(champ, sigma, sy=None):
    sy = sigma if sy is None else sy
    n = N * 2
    grand = np.zeros((n, n))
    grand[:N, :N] = champ
    f = np.fft.fftfreq(n)
    noyau = np.exp(-2 * np.pi ** 2 * ((sy * f[:, None]) ** 2 + (sigma * f[None, :]) ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(grand) * noyau))[:N, :N].clip(0, None)


def decale(champ, dx, dy):
    out = np.zeros_like(champ)
    h, w = champ.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = \
        champ[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def rvb(c):
    return c[None, None, :]


def ecran(fond, lumiere):
    """Additif doux : la lumiere s'ajoute sans bruler en blanc trop vite."""
    return 1 - (1 - fond) * (1 - lumiere.clip(0, 1))


def sol_mouille(m):
    pil = Image.fromarray((m * 255).astype(np.uint8))
    petit = np.asarray(pil.resize((int(N * 0.86),) * 2, Image.LANCZOS)) / 255
    mm = np.zeros_like(m)
    o = (N - petit.shape[0]) // 2
    mm[o:o + petit.shape[0], o:o + petit.shape[1]] = petit
    mm = decale(mm, 0, -170)
    img = np.ones((N, N, 3)) * rvb(NUIT)
    img = img + (flou(rng.normal(0, 1, (N, N)), 3) * 0.02)[..., None] * rvb(BRIQUE)
    cone = np.exp(-((xx - 0.5) ** 2) / 0.09 - (yy + 0.1) ** 2 / 0.25)
    img = ecran(img, cone[..., None] * rvb(AMBRE_CHAUD) * 0.22)
    horizon = 0.68
    sol_doux = ((yy - horizon) / 0.06).clip(0, 1)
    img = img * (1 - 0.25 * sol_doux[..., None])
    halo = flou(mm, 24) * 0.5 + flou(mm, 90) * 0.45 + flou(mm, 260) * 0.3
    img = ecran(img, halo[..., None] * rvb(AMBRE_CHAUD) * 0.9)
    # le reflet : retourne autour de l'horizon, etire, flou vertical, ride
    ligne = int(horizon * N)
    reflet = np.zeros_like(mm)
    reflet[ligne:] = mm[2 * ligne - N:ligne][::-1]
    reflet = flou(reflet, 10, 55)
    bruit = flou(rng.normal(0, 1, (N, N)), 70, 3)
    reflet = flou(reflet * (1 + 0.45 * bruit / bruit.std()).clip(0.2, 2), 4, 8)
    # Le reflet s'eteint AVANT le bas du cadre, et se brouille en s'eloignant
    # de l'horizon : coupe net par le bord de l'image, il se lisait comme une
    # erreur dans l'e-mail (retour de Mathys du 3 novembre).
    loin = ((yy - horizon) / FIN_REFLET).clip(0, 1)
    reflet = reflet * (1 - loin) + flou(reflet, 40, 140) * loin
    reflet = reflet * (1 - loin) ** 1.6 * sol_doux
    img = ecran(img, reflet[..., None] * rvb(AMBRE_CHAUD) * 0.62)
    # la face eclairee
    creux = flou(mm, 30) * mm
    coeur = ((creux - 0.6) / 0.4).clip(0, 1) ** 1.4 * 0.8
    face = rvb(AMBRE) * (1 - coeur[..., None]) + rvb(JAUNE) * coeur[..., None]
    return img, face, mm


def fondre(fond):
    """Ramene la lumiere a la nuit exacte vers les bords, en rond (lissage de
    Hermite). Un fondu rectangulaire laissait voir un carre plus clair que le
    fond de l'e-mail ; seule la lumiere est fondue, jamais le Maillon."""
    h, w, _ = fond.shape
    y, x = np.mgrid[0:h, 0:w]
    r = np.hypot((x + 0.5) / w - 0.5, (y + 0.5) / h - 0.5) / 0.5
    t = ((1 - r) / 0.45).clip(0, 1)
    a = (t * t * (3 - 2 * t))[..., None]
    return fond * a + rvb(NUIT) * (1 - a)


if __name__ == '__main__':
    m = np.asarray(Image.open(sys.argv[1]).convert('L')) / 255.0
    g, h, d, b = CADRE
    fond, face, mm = sol_mouille(m)
    fond, face, mm = fond[h:b, g:d], face[h:b, g:d], mm[h:b, g:d, None]
    img = fondre(fond) * (1 - mm) + face * mm
    im = Image.fromarray(np.uint8((img.clip(0, 1) * 255).round()))
    im = im.resize((SORTIE, round(SORTIE * (b - h) / (d - g))), Image.LANCZOS)
    # la trame contre les escaliers, sauf la ou l'image doit valoir NUIT pile
    a = np.asarray(im).astype(np.float64)
    nuit = (np.abs(a - NUIT * 255).max(axis=2) < 0.5)[..., None]
    a = np.where(nuit, a, a + rng.uniform(-0.5, 0.5, a.shape))
    Image.fromarray(np.uint8(a.clip(0, 255).round())).save(sys.argv[2], optimize=True)
