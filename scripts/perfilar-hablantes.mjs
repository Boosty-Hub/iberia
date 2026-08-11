/**
 * Muestra, por cada hablante de cada sesión, los indicios que permiten
 * identificarlo: sus primeros turnos, sus turnos más largos y las veces que
 * alguien lo llama por su nombre.
 *
 *   node --env-file=.env.local scripts/perfilar-hablantes.mjs [ENT-002]
 *
 * Existe porque Fireflies renumera los hablantes en cada grabación: el
 * "speaker 3" de una sesión no es el de la siguiente.
 */

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const filtro = process.argv[2]

const NOMBRES = [
  'Alberto', 'Antonio', 'Flaviano', 'Dora', 'Marta', 'Milagro', 'Gustavo',
  'Luis', 'Ana Karina', 'Gabriel', 'Carlos', 'Josué', 'Jesús', 'Melanie',
  'Amanda', 'Carolina', 'Andreina', 'Delina',
]

const { data: sesiones } = await admin
  .from('entrevistas')
  .select('id, codigo, entrevistado_nombre')
  .order('codigo')

for (const s of sesiones ?? []) {
  if (filtro && s.codigo !== filtro) continue

  const segmentos = []
  for (let desde = 0; ; desde += 1000) {
    const { data } = await admin
      .from('transcripcion_segmentos')
      .select('indice, hablante, texto')
      .eq('entrevista_id', s.id)
      .order('indice')
      .range(desde, desde + 999)
    if (!data?.length) break
    segmentos.push(...data)
    if (data.length < 1000) break
  }

  console.log(`\n${'='.repeat(78)}`)
  console.log(`${s.codigo} · ${s.entrevistado_nombre} · ${segmentos.length} turnos`)
  console.log('='.repeat(78))

  const porHablante = new Map()
  for (const seg of segmentos) {
    const h = seg.hablante ?? '(sin atribuir)'
    if (!porHablante.has(h)) porHablante.set(h, [])
    porHablante.get(h).push(seg)
  }

  const ordenados = [...porHablante.entries()].sort(
    (a, b) =>
      b[1].reduce((n, s) => n + s.texto.length, 0) -
      a[1].reduce((n, s) => n + s.texto.length, 0)
  )

  for (const [hablante, turnos] of ordenados) {
    const palabras = turnos.reduce(
      (n, t) => n + t.texto.trim().split(/\s+/).filter(Boolean).length,
      0
    )

    // A quién nombra este hablante: delata de qué lado de la mesa está.
    const nombra = new Set()
    for (const t of turnos) {
      for (const n of NOMBRES) {
        if (new RegExp(`\\b${n}\\b`, 'i').test(t.texto)) nombra.add(n)
      }
    }

    console.log(`\n── ${hablante}  ·  ${turnos.length} turnos  ·  ${palabras} palabras`)
    if (nombra.size) console.log(`   nombra a: ${[...nombra].join(', ')}`)

    // Los turnos más largos son los que revelan el rol.
    const largos = [...turnos].sort((a, b) => b.texto.length - a.texto.length).slice(0, 3)
    for (const t of largos) {
      console.log(`   [#${t.indice}] ${t.texto.slice(0, 260).replace(/\s+/g, ' ')}…`)
    }
  }
}
