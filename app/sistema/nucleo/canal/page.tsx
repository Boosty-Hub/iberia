import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { fechaHora, numero } from '@/lib/plataforma/formato'
import { CabeceraModulo, BOTON_CABECERA } from '@/components/sistema/ui/cabecera-modulo'
import { BarrasApiladas, ListaAlertas } from '@/components/sistema/procesos/piezas-r2'
import { MOTIVOS_REPORTE, TIPOS_REPORTABLES, type MotivoReporte, type TipoReportable } from '@/lib/reportes'
import { NIVELES_EMPLEADO, TIPOS_PUBLICACION, type NivelEmpleado, type TipoPublicacion } from '@/lib/canal'
import { TRAMOS_USO, filasUso, leerUso } from './datos'

export const metadata: Metadata = { title: 'Resumen · Canal' }

const METRICAS = ['canal_personas_activas', 'canal_publicaciones_mes', 'canal_mensajes_mes', 'canal_grupos', 'canal_reportes_abiertos']

/**
 * Resumen del canal (NUC-CAN): las cinco cifras del registro, lo que espera
 * moderación, lo último publicado y la adopción por nivel. Todo son cuentas: la
 * plataforma no lee el texto de ningún mensaje privado.
 */
export default async function ResumenCanalPage({ searchParams }: PageProps<'/sistema/nucleo/canal'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:reportes'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const [, { data: reportes, count: abiertos }, { data: publicaciones }, uso] = await Promise.all([
    precargarMetricas(METRICAS, ctx),
    supabase
      .from('reportes')
      .select('id, tipo, motivo, extracto, created_at', { count: 'exact' })
      .eq('estado', 'abierto')
      .order('created_at', { ascending: false })
      .range(0, 4),
    supabase.schema('ui').rpc('canal_publicaciones').range(0, 4),
    leerUso(ctx.al),
  ])

  const porNivel = filasUso(uso, 'nivel').map((f) => ({
    ...f,
    etiqueta: NIVELES_EMPLEADO[f.clave as NivelEmpleado] ?? f.etiqueta,
    href: `/sistema/nucleo/canal/uso?f.nivel=${encodeURIComponent(f.clave)}`,
  }))

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-CAN"
        titulo="Canal"
        migas={[{ etiqueta: 'Resumen' }]}
        descripcion="La app de comunicación de toda la planta: el feed, los mensajes, los grupos y la moderación. Las cifras son cuentas; el contenido de los mensajes privados no se lee desde aquí."
        acciones={
          puede(sesion, 'modulo:canal') ? (
            <Link href="/canal" className={BOTON_CABECERA}>
              Abrir la app
            </Link>
          ) : null
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <KpiMetrica clave="canal_personas_activas" ctx={ctx} sesion={sesion} titulo="Personas activas · 30 días" />
        <KpiMetrica clave="canal_publicaciones_mes" ctx={ctx} sesion={sesion} />
        <KpiMetrica clave="canal_mensajes_mes" ctx={ctx} sesion={sesion} />
        <KpiMetrica clave="canal_grupos" ctx={ctx} sesion={sesion} titulo="Grupos activos" />
        <KpiMetrica clave="canal_reportes_abiertos" ctx={ctx} sesion={sesion} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="min-w-0">
        <ListaAlertas
          titulo="Reportes por revisar"
          icono="⚑"
          total={abiertos ?? 0}
          hrefTodos="/sistema/nucleo/canal/moderacion"
          vacio="No hay reportes por revisar."
          items={(reportes ?? []).map((r) => ({
            clave: r.id,
            titulo: r.extracto || 'Sin texto',
            detalle: `${TIPOS_REPORTABLES[r.tipo as TipoReportable] ?? r.tipo} · ${MOTIVOS_REPORTE[r.motivo as MotivoReporte] ?? r.motivo} · ${fechaHora(r.created_at)}`,
            href: '/sistema/nucleo/canal/moderacion',
          }))}
        />
        </div>
        <div className="min-w-0">
        <ListaAlertas
          titulo="Lo último en el feed"
          icono="▤"
          total={(publicaciones ?? []).length}
          hrefTodos="/sistema/nucleo/canal/publicaciones"
          vacio="Todavía no hay publicaciones."
          items={(publicaciones ?? []).map((p) => ({
            clave: p.id,
            titulo: `${p.oficial ? '★ ' : ''}${p.titulo}`,
            detalle: `${TIPOS_PUBLICACION[p.tipo as TipoPublicacion] ?? p.tipo} · ${p.estado === 'publicado' ? `${numero(p.lecturas)} lecturas` : p.estado} · ${fechaHora(p.publicado_en ?? p.creado_en)}`,
            href: `/sistema/nucleo/canal/publicaciones?estado=${p.estado === 'publicado' ? 'publicado' : p.estado}`,
          }))}
        />
        </div>
        <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5 lg:col-span-2">
          <h2 className="mb-2 text-[12.5px] font-semibold text-marca-800">Adopción por nivel · 30 días</h2>
          <BarrasApiladas filas={porNivel} tramos={TRAMOS_USO} titulo="Personas del padrón por nivel: activas, con cuenta sin actividad y sin cuenta" />
          <Link href="/sistema/nucleo/canal/uso" className="mt-2 inline-block text-[12px] font-semibold text-acento-700 hover:underline">
            Ver el uso por área y sede →
          </Link>
        </section>
      </div>
    </>
  )
}
