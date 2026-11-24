"""Inventario de los archivos de origen: por extensión, duplicados por contenido y archivo principal por documento."""
import json, sys, os, collections, hashlib

docs = json.load(open(sys.argv[1], encoding='utf-8'))[0]['json_agg']
base = sys.argv[2]
salida = sys.argv[3]
BS = chr(92)

info = {}
for x in docs:
    for r in x['a']:
        if r in info:
            continue
        p = os.path.join(base, *r.split(BS))
        if not os.path.isfile(p):
            info[r] = None
            continue
        h = hashlib.sha256()
        with open(p, 'rb') as f:
            for b in iter(lambda: f.read(1 << 20), b''):
                h.update(b)
        info[r] = {'tam': os.path.getsize(p), 'hash': h.hexdigest(), 'ext': os.path.splitext(r)[1].lower()}

ext_n = collections.Counter(); ext_b = collections.Counter()
for r, v in info.items():
    if v:
        ext_n[v['ext']] += 1; ext_b[v['ext']] += v['tam']
print('por extension', {k: (ext_n[k], round(ext_b[k] / 1e6)) for k in ext_n})
hashes = {}
for r, v in info.items():
    if v:
        hashes.setdefault(v['hash'], []).append(r)
uni_b = sum(info[rs[0]]['tam'] for rs in hashes.values())
print('archivos', sum(1 for v in info.values() if v), 'contenidos unicos', len(hashes), 'MB unicos', round(uni_b / 1e6))
json.dump(info, open(salida, 'w', encoding='utf-8'), ensure_ascii=False)
