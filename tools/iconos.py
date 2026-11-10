#!/usr/bin/env python3
"""Genera los iconos de Rutineitor (PNG) sin depender de nada externo."""
import math
import os
import sys
from PIL import Image, ImageDraw

SALIDA = sys.argv[1] if len(sys.argv) > 1 else "dist"
VERDE = (95, 214, 138)
LIMA = (200, 224, 106)
FONDO_A = (24, 54, 36)
FONDO_B = (9, 24, 16)


def degradado(tam):
    img = Image.new("RGB", (tam, tam), FONDO_B)
    d = ImageDraw.Draw(img)
    for y in range(tam):
        t = y / max(1, tam - 1)
        c = tuple(int(FONDO_A[i] + (FONDO_B[i] - FONDO_A[i]) * t) for i in range(3))
        d.line([(0, y), (tam, y)], fill=c)
    return img


def redondear(img, radio):
    mascara = Image.new("L", img.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1],
                                              radius=radio, fill=255)
    salida = Image.new("RGBA", img.size, (0, 0, 0, 0))
    salida.paste(img, (0, 0), mascara)
    return salida


def dibujar(tam, margen_rel=0.0, redondeado=True):
    escala = 4
    g = degradado(tam * escala)
    radio = int(tam * escala * (0.22 if redondeado else 0.5))
    img = redondear(g, radio) if redondeado else redondear(g, radio)
    d = ImageDraw.Draw(img)

    c = tam * escala / 2
    margen = tam * escala * margen_rel
    r = (tam * escala / 2 - margen) * 0.62
    grosor = int(r * 0.19)

    # Anillo de progreso (3/4 de vuelta): la idea de "rutina que avanza".
    caja = [c - r, c - r, c + r, c + r]
    # El carril se dibuja en un verde apagado opaco: con alfa, PIL sustituye
    # el canal en vez de mezclarlo y aparecía un trozo blanco.
    d.arc(caja, start=135, end=360 + 45, fill=(46, 82, 60, 255), width=grosor)
    d.arc(caja, start=135, end=135 + 260, fill=VERDE + (255,), width=grosor)

    # Marca de verificación dentro del anillo.
    p1 = (c - r * 0.42, c + r * 0.02)
    p2 = (c - r * 0.10, c + r * 0.36)
    p3 = (c + r * 0.46, c - r * 0.34)
    d.line([p1, p2], fill=LIMA + (255,), width=int(grosor * 1.15), joint="curve")
    d.line([p2, p3], fill=LIMA + (255,), width=int(grosor * 1.15), joint="curve")
    for p in (p1, p2, p3):
        rr = grosor * 0.57
        d.ellipse([p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr], fill=LIMA + (255,))

    return img.resize((tam, tam), Image.LANCZOS)


def main():
    os.makedirs(SALIDA, exist_ok=True)
    salidas = [
        ("icon-192.png", 192, 0.0, True),
        ("icon-512.png", 512, 0.0, True),
        ("icon-maskable-512.png", 512, 0.14, False),
        ("apple-touch-icon.png", 180, 0.0, True),
        ("favicon-32.png", 32, 0.0, True),
    ]
    for nombre, tam, margen, redondeado in salidas:
        img = dibujar(tam, margen, redondeado)
        if not redondeado:
            # Maskable: fondo completo, sin esquinas transparentes.
            plano = Image.new("RGBA", img.size, (13, 31, 21, 255))
            plano.alpha_composite(img)
            img = plano
        img.save(os.path.join(SALIDA, nombre))
        print(f"  {nombre} ({tam}px)")


if __name__ == "__main__":
    main()
