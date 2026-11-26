"""Extrae el texto de cada página de los PDF de documentos (plataforma/_trabajo/documentos-pdf/pdf-final,
fuera de git) a un JSONL para el índice del asistente (asistente.documento_pagina).

    python scripts/asistente/extraer-paginas.py [--max-paginas 300]

Salida: plataforma/_trabajo/documentos-pdf/paginas.jsonl, una línea por página:
{"pdf": "<nombre>.pdf", "pagina": N, "texto": "..."}. Las páginas sin texto (escaneos sin
OCR) no se escriben. El texto se corta en 20.000 caracteres por página.
"""
import json
import os
import sys

import fitz  # PyMuPDF

sys.stdout.reconfigure(encoding='utf-8')

BASE = os.path.join('plataforma', '_trabajo', 'documentos-pdf')
MAX = int(sys.argv[sys.argv.index('--max-paginas') + 1]) if '--max-paginas' in sys.argv else 300

salida = os.path.join(BASE, 'paginas.jsonl')
n_pdf = n_pag = n_vacias = 0
with open(salida, 'w', encoding='utf-8') as out:
    for nombre in sorted(os.listdir(os.path.join(BASE, 'pdf-final'))):
        if not nombre.endswith('.pdf'):
            continue
        try:
            doc = fitz.open(os.path.join(BASE, 'pdf-final', nombre))
        except Exception as e:  # noqa: BLE001
            print('no abre', nombre, e)
            continue
        n_pdf += 1
        for i, pagina in enumerate(doc):
            if i >= MAX:
                break
            texto = ' '.join(pagina.get_text('text').split())
            if len(texto) < 20:
                n_vacias += 1
                continue
            out.write(json.dumps({'pdf': nombre, 'pagina': i + 1, 'texto': texto[:20000]}, ensure_ascii=False) + '\n')
            n_pag += 1
        doc.close()
print(f'{n_pdf} PDF · {n_pag} páginas con texto · {n_vacias} sin texto → {salida}')
