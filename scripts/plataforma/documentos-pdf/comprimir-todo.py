"""Deja en pdf-final/ el PDF optimizado de cada archivo del manifiesto y anota su peso y páginas en final.json.

- Office: el PDF que sacó Word/Excel/PowerPoint (pdf-office/), recomprimido.
- PDF: el original recomprimido. Imágenes: a PDF, a 150 ppp como mucho.
Incremental: lo que ya está en final.json con su archivo no se rehace. Uso: python -P -X utf8 comprimir-todo.py <base>
"""
import json, os, sys
import subprocess
from concurrent.futures import ThreadPoolExecutor

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
BS = chr(92)


def procesar(tarea):
    import pymupdf
    a, base = tarea
    dst = os.path.join(AQUI, 'pdf-final', a['pdf'])
    try:
        if a['clase'] == 'office':
            src = os.path.join(AQUI, 'pdf-office', a['pdf'])
            if not os.path.isfile(src):
                return a['pdf'], None
        elif a['clase'] == 'pdf':
            src = os.path.join(base, *a['ruta'].split(BS))
        else:  # imagen
            img = pymupdf.open(os.path.join(base, *a['ruta'].split(BS)))
            pdf = pymupdf.open('pdf', img.convert_to_pdf())
            src = dst + '.tmp.pdf'
            pdf.save(src)
            pdf.close(); img.close()
        # Cada compresión en su propio proceso, con tope de tiempo: un PDF raro que tumba a MuPDF no se lleva el lote.
        try:
            subprocess.run([sys.executable, '-P', '-X', 'utf8', os.path.join(AQUI, 'comprimir.py'), src, dst], timeout=180, check=True, capture_output=True)
        except Exception:
            import shutil; shutil.copyfile(src, dst)  # sin comprimir, tal cual
        if os.path.getsize(dst) > os.path.getsize(src) and a['clase'] != 'imagen':
            import shutil; shutil.copyfile(src, dst)
        if src.endswith('.tmp.pdf'):
            os.remove(src)
        d = pymupdf.open(dst); paginas = d.page_count; d.close()
        return a['pdf'], {'tam': os.path.getsize(dst), 'paginas': paginas}
    except Exception as e:
        return a['pdf'], {'error': str(e)[:200]}


if __name__ == '__main__':
    base = sys.argv[1]
    os.makedirs(os.path.join(AQUI, 'pdf-final'), exist_ok=True)
    man = json.load(open(os.path.join(AQUI, 'manifiesto.json'), encoding='utf-8'))
    ruta_final = os.path.join(AQUI, 'final.json')
    final = json.load(open(ruta_final, encoding='utf-8')) if os.path.isfile(ruta_final) else {}
    vistos = set()
    tareas = []
    for a in man:
        if a.get('clase') not in ('office', 'pdf', 'imagen') or a['pdf'] in vistos:
            continue
        vistos.add(a['pdf'])
        f = final.get(a['pdf'])
        if f and 'tam' in f and os.path.isfile(os.path.join(AQUI, 'pdf-final', a['pdf'])):
            continue
        tareas.append((a, base))
    hechos = errores = 0
    with ThreadPoolExecutor(max_workers=10) as ex:
        for nombre, r in ex.map(procesar, tareas):
            if r is None:
                continue
            final[nombre] = r
            if 'error' in r:
                errores += 1
            else:
                hechos += 1
    json.dump(final, open(ruta_final, 'w', encoding='utf-8'))
    ok = [v for v in final.values() if 'tam' in v]
    print(f'nuevos {hechos}, errores {errores}; en total {len(ok)} PDF, {sum(v["tam"] for v in ok) / 1e6:.1f} MB')
