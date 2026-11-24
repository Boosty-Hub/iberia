"""Manifiesto de la conversión: cada archivo único → su PDF (nombre por huella), en 3 tandas para Office."""
import json, sys, os

docs = json.load(open(sys.argv[1], encoding='utf-8'))[0]['json_agg']
info = json.load(open(sys.argv[2], encoding='utf-8'))
salida = sys.argv[3]
OFFICE = {'.doc', '.docx', '.dot', '.rtf', '.xls', '.xlsx', '.ppt', '.pptx'}
IMAGEN = {'.jpg', '.jpeg', '.gif', '.bmp', '.png'}

archivos = {}
for d in docs:
    for r in d['a']:
        v = info.get(r)
        if r in archivos:
            archivos[r]['docs'].append(d['id'])
            continue
        if not v:
            archivos[r] = {'ruta': r, 'estado': 'falta', 'docs': [d['id']]}
            continue
        ext = v['ext']
        clase = 'office' if ext in OFFICE else 'pdf' if ext == '.pdf' else 'imagen' if ext in IMAGEN else 'sin_conversion'
        archivos[r] = {'ruta': r, 'ext': ext, 'tam': v['tam'], 'hash': v['hash'], 'clase': clase, 'pdf': v['hash'][:20] + '.pdf', 'docs': [d['id']]}

lista = list(archivos.values())
json.dump(lista, open(os.path.join(salida, 'manifiesto.json'), 'w', encoding='utf-8'), ensure_ascii=False)
office = sorted((a for a in lista if a.get('clase') == 'office'), key=lambda a: -a['tam'])
tandas = [[], [], []]
for i, a in enumerate(office):
    tandas[i % 3].append(f"{a['ruta']}\t{a['pdf']}")
for i, t in enumerate(tandas):
    open(os.path.join(salida, f'tanda-{i}.tsv'), 'w', encoding='utf-8').write('\n'.join(t))
from collections import Counter
print(Counter(a.get('clase', a.get('estado')) for a in lista), [len(t) for t in tandas])
