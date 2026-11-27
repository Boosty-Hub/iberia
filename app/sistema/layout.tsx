import Link from 'next/link'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PESTANAS, type Pestana } from '@/lib/plataforma/dominios'
import { iniciales } from '@/lib/plataforma/formato'
import { COOKIE_COLUMNA, COOKIE_RIEL, leerMoneda, modulosDelPlan, modulosVisibles, tasasDelDia } from '@/lib/plataforma/servidor'
import { misPendientes } from '@/components/sistema/shell/acciones'
import { leerResumen } from '@/components/sistema/colaboracion/datos'
import { BandaVerComo, BandasContexto } from '@/components/sistema/shell/bandas'
import { BotonBuscar, Campana, ControlesContexto, InterruptorMoneda, MenuPersona, VerComo } from '@/components/sistema/shell/barra-cliente'
import { SoporteBoosty } from '@/components/sistema/shell/soporte-boosty'
import { MisCambios } from '@/components/sistema/shell/mis-cambios'
import { BarraTasas, PuntoJd } from '@/components/sistema/shell/barra-tasas'
import { MenuTelefono } from '@/components/sistema/shell/menu-telefono'
import { ColumnaModulos, NavegacionTelefono, Riel, type VistaMenu } from '@/components/sistema/shell/navegacion'
import { Desplegable } from '@/components/sistema/ui/desplegable'
import { PanelFicha } from '@/components/sistema/ui/ficha-objeto'
import { PaletaComandos, type AccionPaleta } from '@/components/sistema/ui/paleta-comandos'
import { PanelAsistente } from '@/components/sistema/asistente/panel-asistente'
import { estadoIa } from '@/lib/ia/servidor'

/**
 * El armazón de la Plataforma Iberia (Anexo E §3, modelo v2): barra carbón con
 * los controles globales, riel de dominios con nombres (plegable a iconos),
 * columna de módulos del dominio, zona de trabajo y panel lateral del objeto.
 *
 * Lo que sale en el menú lo decide el permiso de cada módulo (el mismo que pide
 * su página); la base, con RLS, decide lo que de verdad se lee. El contexto
 * global (fecha, escenario) vive en la URL; la moneda y el riel, en cookies.
 */
export default async function SistemaLayout({ children }: LayoutProps<'/sistema'>) {
  const sesion = await requerirSesion()
  const supabase = await createClient()
  const jar = await cookies()
  const esAdminReal = sesion.rolReal.nivel === 'admin'

  const [modulos, tasas, moneda, escenarios, vistas, pendientes, roles, empleado, resumen, ia, misCambios] = await Promise.all([
    modulosDelPlan(),
    tasasDelDia(sesion),
    leerMoneda(),
    puede(sesion, 'sistema:escenarios')
      ? supabase.schema('org').from('escenario').select('id, nombre, alcance').in('estado', ['borrador', 'en_aprobacion']).order('creado_en', { ascending: false }).range(0, 29)
      : null,
    supabase.schema('ui').from('vista').select('id, nombre, alcance, ruta, parametros, modulo').order('nombre').range(0, 199),
    misPendientes().catch(() => []),
    esAdminReal ? supabase.from('roles').select('id, nombre').order('nombre') : null,
    // ¿Tiene ficha en el padrón? (el enlace «El canal»). Con el id de la sesión: sin otro getUser().
    puede(sesion, 'modulo:canal')
      ? supabase.from('empleados').select('id').eq('perfil_id', sesion.userId).eq('activo', true).maybeSingle().then((r) => r.data)
      : null,
    // La campana: la bandeja ya viene en `pendientes`, no se pide dos veces.
    leerResumen(0).catch(() => ({ noLeidas: 0, ultimas: [], porDecidir: 0 })),
    // El interruptor de la IA de Ctrl K: en la misma tanda, no una vuelta más al final.
    estadoIa(),
    // «Mis cambios»: lo que tengo en mi borrador sin enviar a aprobación (24-nov-2026).
    supabase
      .schema('org')
      .from('cambio')
      .select('id, escenario!inner(estado, tipo, creado_por)', { count: 'exact', head: true })
      .eq('escenario.tipo', 'cambios')
      .eq('escenario.estado', 'borrador')
      .eq('escenario.creado_por', sesion.userId)
      .then((r) => r.count ?? 0, () => 0),
  ])
  const avisos = { ...resumen, porDecidir: pendientes.length }

  const menu = modulosVisibles(sesion, modulos)
  const pestanas: Record<string, Pestana[]> = {}
  for (const [codigo, lista] of Object.entries(PESTANAS)) {
    pestanas[codigo] = lista.filter((p) => !p.recurso || puede(sesion, p.recurso, p.accion ?? 'ver') || (p.accion === 'crear' && puede(sesion, p.recurso)))
  }

  const vistasMenu: VistaMenu[] = (vistas.data ?? []).map((v) => {
    const params = new URLSearchParams(String((v.parametros as { consulta?: string } | null)?.consulta ?? ''))
    params.set('vista', v.id)
    return { id: v.id, nombre: v.nombre, alcance: v.alcance as VistaMenu['alcance'], modulo: v.modulo, href: `${v.ruta}?${params}` }
  })

  // La barra según los permisos (26-nov-2026, Gabriel): «Datos al» y el punto de JD solo con módulos que tienen historia
  // por fecha; Realidad/Escenario, con la casilla de escenarios; Bs/USD, donde hay montos (costos, dotación, requisiciones).
  const conFecha = ['sistema:estructura', 'sistema:procesos', 'sistema:documentos', 'sistema:escenarios', 'sistema:dotacion', 'sistema:costos', 'sistema:requisiciones', 'sistema:auditoria'].some((r) => puede(sesion, r))
  const conMoneda = ['sistema:costos', 'sistema:dotacion', 'sistema:requisiciones'].some((r) => puede(sesion, r))
  const acciones: AccionPaleta[] = [
    { etiqueta: 'Ir a Mi día', href: '/sistema' },
    { etiqueta: 'Mis aprobaciones', href: '/sistema/bandeja', detalle: `${pendientes.length} por decidir` },
    ...(puede(sesion, 'sistema:requisiciones', 'crear') ? [{ etiqueta: 'Nueva requisición de personal', href: '/sistema/nucleo/organizacion/requisiciones/nueva' }] : []),
    ...(puede(sesion, 'sistema:escenarios', 'crear')
      ? [
          { etiqueta: 'Nuevo escenario de estructura', href: '/sistema/nucleo/escenarios?nuevo=1', detalle: 'copia la estructura de hoy' },
          { etiqueta: 'Nuevo escenario de procesos', href: '/sistema/nucleo/procesos/escenarios', detalle: 'desde el catálogo' },
        ]
      : []),
    ...(puede(sesion, 'sistema:escenarios') ? [{ etiqueta: 'Abrir un escenario…', href: '/sistema/nucleo/escenarios' }] : []),
    ...(conFecha ? [{ etiqueta: 'Ir a «Datos al»…', href: '', clave: 'fecha' as const, detalle: 'ver las cifras y las tablas a otra fecha' }] : []),
    ...(puede(sesion, 'sistema:tasas', 'editar') ? [{ etiqueta: 'Cargar una tasa a mano', href: '/sistema/finanzas/tasas#cargar-tasa', detalle: 'respaldo, con motivo' }] : []),
    ...(puede(sesion, 'sistema:tasas') ? [{ etiqueta: 'Tasas de cambio', href: '/sistema/finanzas/tasas', detalle: 'BCV y fecha valor' }] : []),
    { etiqueta: 'Registro de métricas', href: '/sistema/datos/metricas', detalle: 'qué cuenta cada cifra' },
    ...(puede(sesion, 'sistema:estructura') ? [{ etiqueta: 'Explorar las plazas', href: '/sistema/nucleo/organizacion/plazas' }] : []),
    ...(puede(sesion, 'sistema:procesos') ? [{ etiqueta: 'Mapa de procesos', href: '/sistema/nucleo/procesos' }] : []),
    ...(puede(sesion, 'sistema:documentos') ? [{ etiqueta: 'Biblioteca de documentos', href: '/sistema/nucleo/documentos' }] : []),
    ...(puede(sesion, 'modulo:usuarios') ? [{ etiqueta: 'Usuarios', href: '/sistema/administracion/usuarios' }] : []),
    ...(puede(sesion, 'modulo:reportes') ? [{ etiqueta: 'Moderación del canal', href: '/sistema/nucleo/canal/moderacion', detalle: 'lo que la gente reporta' }] : []),
  ]

  const listaEscenarios = escenarios?.data ?? []
  const nombre = sesion.perfil.nombre_completo || sesion.email
  const modoRiel = jar.get(COOKIE_RIEL)?.value === 'iconos' ? 'iconos' : 'nombres'
  const modoColumna = jar.get(COOKIE_COLUMNA)?.value === 'plegada' ? 'plegada' : 'abierta'
  const puedeEsc = puede(sesion, 'sistema:escenarios')
  const conContexto = conFecha || puedeEsc || conMoneda

  return (
    <div className="plataforma flex min-h-dvh flex-1 flex-col bg-[#f4f5f7] text-[13px]">
      <a href="#contenido" className="sr-only z-[70] rounded-lg bg-white px-3 py-2 text-sm font-semibold text-marca-900 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Saltar al contenido
      </a>

      {/* En el teléfono (y en la app) la barra baja del área segura: si no, queda debajo de la hora y la batería (26-nov-2026). */}
      <header className="sticky top-0 z-40 flex h-[var(--alto-barra)] items-center gap-2 bg-[#2b2a28] px-2.5 pt-[var(--seguro-arriba)] text-white sm:px-3">
        <MenuTelefono>
          <div className="border-b border-[var(--borde)] p-3 min-[480px]:hidden">
            <div className="inline-flex rounded-lg bg-[#2b2a28] p-1">
              <BarraTasas t={tasas} enlace={puede(sesion, 'sistema:tasas')} compacta />
            </div>
          </div>
          <Suspense>
            {conContexto && (
              <div className="flex flex-col gap-2 border-b border-[var(--borde)] p-3">
                <ControlesContexto escenarios={listaEscenarios} puedeEscenarios={puedeEsc} conFecha={conFecha} claro />
                {conMoneda && <InterruptorMoneda inicial={moneda} tasaUsd={tasas?.usd ?? null} fechaValor={tasas?.usdFechaValor ?? null} claro />}
              </div>
            )}
            <NavegacionTelefono modulos={menu} pestanas={pestanas} vistas={vistasMenu} />
          </Suspense>
        </MenuTelefono>

        <Link href="/sistema" className="flex shrink-0 items-center gap-2 rounded-lg font-extrabold tracking-wide whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <span className="rounded-md bg-[#D4332C] px-1.5 py-0.5 text-[12px]">IB</span>
          <span className="hidden text-[14px] sm:inline">Plataforma Iberia</span>
        </Link>

        <div className="hidden min-w-0 flex-1 min-[901px]:flex">
          <BotonBuscar />
        </div>
        <div className="flex-1 min-[901px]:hidden" />

        {conContexto && (
          <div className="hidden items-center gap-2 min-[1240px]:flex">
            <Suspense>
              <ControlesContexto escenarios={listaEscenarios} puedeEscenarios={puedeEsc} conFecha={conFecha} />
            </Suspense>
            {conMoneda && <InterruptorMoneda inicial={moneda} tasaUsd={tasas?.usd ?? null} fechaValor={tasas?.usdFechaValor ?? null} />}
          </div>
        )}
        {conContexto && (
        <Desplegable
          etiqueta="Contexto: fecha de los datos, escenario y moneda"
          alinear="der"
          ancho="w-80"
          className="hidden min-[901px]:block min-[1240px]:hidden"
          claseBoton="inline-flex h-8 items-center gap-1 rounded-lg border border-[#4a4845] bg-[#3a3936] px-2.5 text-xs text-[#e8e5df] hover:bg-[#45433f]"
          boton={<>Contexto ▾</>}
        >
          <Suspense>
            <div className="flex flex-col gap-2 p-3">
              <ControlesContexto escenarios={listaEscenarios} puedeEscenarios={puedeEsc} conFecha={conFecha} claro />
              {conMoneda && <InterruptorMoneda inicial={moneda} tasaUsd={tasas?.usd ?? null} fechaValor={tasas?.usdFechaValor ?? null} claro />}
            </div>
          </Suspense>
        </Desplegable>
        )}

        <div className="hidden sm:flex">
          <BarraTasas t={tasas} enlace={puede(sesion, 'sistema:tasas')} />
        </div>
        {/* Por debajo de 480 px las tasas van en el menú: en la barra no cabían el «Ticket» y la persona. */}
        <div className="hidden min-[480px]:block sm:hidden">
          <BarraTasas t={tasas} enlace={puede(sesion, 'sistema:tasas')} compacta />
        </div>
        {conFecha && <PuntoJd />}
        {esAdminReal && roles?.data && (
          <div className="hidden xl:block">
            <VerComo roles={roles.data} activo={sesion.vistaComo?.rolId ?? null} rolReal={sesion.rolReal.id} />
          </div>
        )}
        <div className="min-[901px]:hidden">
          <BotonBuscar compacto />
        </div>
        {/* Ir al Portal planta (24-nov-2026): quien tiene ficha y la casilla del portal. En el teléfono va en el menú de la
            persona (la barra no tiene sitio). En el portal, «Admin» trae de vuelta. */}
        {empleado && puede(sesion, 'modulo:canal') && (
          <Link
            href="/canal"
            className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/25 px-2.5 text-sm font-medium whitespace-nowrap text-white hover:bg-white/10 sm:inline-flex"
            title="Ir al Portal planta"
          >
            <span aria-hidden>📱</span>
            {/* Por debajo de 1536 px, solo el icono: la barra no da para todo (con «Mis cambios» se desbordaba). */}
            <span className="hidden 2xl:inline">Portal planta</span>
            <span className="sr-only 2xl:hidden">Portal planta</span>
          </Link>
        )}
        <MisCambios inicial={misCambios} />
        <Campana inicial={avisos} />
        {/* El soporte de Boosty: el botón «Ticket», justo antes del menú de la persona (con la persona real, no el «ver como»). */}
        <SoporteBoosty nombre={nombre} email={sesion.email} />
        <MenuPersona
          nombre={nombre}
          email={sesion.email}
          rol={sesion.rolReal.nombre}
          iniciales={iniciales(nombre)}
          verComo={sesion.vistaComo?.nombre ?? null}
          conCanal={Boolean(empleado)}
          conPanel={puede(sesion, 'modulo:panel')}
        />
      </header>

      <div className="flex min-w-0 flex-1">
        <Suspense fallback={<div className="hidden w-[184px] shrink-0 border-r border-[var(--borde)] bg-white min-[901px]:block" />}>
          <Riel modulos={menu} modo={modoRiel} />
          <ColumnaModulos modulos={menu} pestanas={pestanas} vistas={vistasMenu} modo={modoColumna} />
        </Suspense>

        <main id="contenido" className="min-w-0 flex-1">
          {sesion.vistaComo && <BandaVerComo rol={sesion.vistaComo.nombre} />}
          <Suspense>
            <BandasContexto escenarios={listaEscenarios} />
          </Suspense>
          <div className="px-3 pt-4 pb-10 sm:px-5">{children}</div>
        </main>

        <Suspense>
          <PanelFicha />
        </Suspense>
      </div>

      <Suspense>
        <PaletaComandos acciones={acciones} conIa={!!ia?.general && puede(sesion, 'sistema:asistente')} />
        {/* «Preguntar a la IA» es el asistente, al costado (lo abren la cabecera, la ficha y Ctrl K). */}
        <PanelAsistente conBoton={!!ia?.general && puede(sesion, 'sistema:asistente')} />
      </Suspense>
    </div>
  )
}
