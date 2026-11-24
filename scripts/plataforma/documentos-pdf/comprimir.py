"""Comprime un PDF para verlo en pantalla. Uso: comprimir.py entrada salida

Cada imagen por encima de 130 ppp (en el tamaño en que se pinta) se re-muestrea a 110 ppp en JPEG calidad 60; una
imagen pesada sin JPEG (PNG, sin comprimir) se pasa a JPEG a su tamaño. Las de transparencia y las de 1 bit (escaneos
en blanco y negro, que ya pesan poco) no se tocan. `rewrite_images` de PyMuPDF no hacía nada con los escaneos de
Iberia (1664×2160 en JPEG por página): este bucle los baja a un tercio y se siguen leyendo.
"""
import sys, pymupdf

UMBRAL_PPP = 130
DESTINO_PPP = 110
CALIDAD = 60
PESADA = 150_000  # bytes del flujo original


def recomprimir_imagenes(doc):
    hechas = set()
    for pg in doc:
        for im in pg.get_images(full=True):
            xref, smask, ancho, alto, bpc, espacio, _, _, filtro = im[0], im[1], im[2], im[3], im[4], im[5], im[6], im[7], im[8]
            if xref in hechas or smask or bpc == 1 or ancho < 64 or alto < 64:
                continue
            hechas.add(xref)
            try:
                rects = pg.get_image_rects(xref)
                if not rects or rects[0].width <= 0:
                    continue
                ppp = ancho / (rects[0].width / 72)
                peso = len(doc.xref_stream_raw(xref) or b'')
                if ppp <= UMBRAL_PPP and (filtro == 'DCTDecode' or peso < PESADA):
                    continue
                pix = pymupdf.Pixmap(doc, xref)
                if pix.alpha:
                    continue
                if pix.colorspace is None:
                    continue
                if pix.colorspace.n not in (1, 3):
                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                if ppp > UMBRAL_PPP:
                    f = DESTINO_PPP / ppp
                    pix = pymupdf.Pixmap(pix, max(1, int(pix.width * f)), max(1, int(pix.height * f)), None)
                nuevo = pix.tobytes('jpeg', jpg_quality=CALIDAD)
                if len(nuevo) < peso * 0.9:
                    pg.replace_image(xref, stream=nuevo)
            except Exception:
                continue


def comprimir(entrada, salida):
    doc = pymupdf.open(entrada)
    recomprimir_imagenes(doc)
    try:
        doc.subset_fonts()
    except Exception:
        pass
    doc.scrub(metadata=True, xml_metadata=True, thumbnails=True, reset_fields=False, reset_responses=False)
    doc.save(salida, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True, use_objstms=1)
    doc.close()


if __name__ == '__main__':
    comprimir(sys.argv[1], sys.argv[2])
