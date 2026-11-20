import Link from 'next/link'
import { IconoCandadito } from '@/components/sistema/shell/iconos'
import type { TasasDelDia } from '@/lib/plataforma/servidor'
import { fechaHora, fechaLarga, porcentaje, tasa, variacion } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * Las tasas en la barra (Anexo E §6): BCV $ y € para todos, con su variación
 * contra la fecha valor anterior; el paralelo y la brecha solo si la base los
 * manda (permiso `sistema:tasas-paralelo`). La variación lleva flecha y signo:
 * nunca solo el color. El detalle (fecha valor, captura, verificación) se ve al
 * pasar el mouse o al enfocar con el teclado.
 */
export function BarraTasas({ t, enlace, compacta = false }: { t: TasasDelDia | null; enlace: boolean; compacta?: boolean }) {
  if (!t || t.usd === null) {
    return (
      <span className="inline-flex h-8 items-center rounded-lg border border-[#4a4845] bg-[#3a3936] px-2.5 text-xs text-[#cfccc6]" title="Todavía no hay una tasa BCV cargada">
        BCV sin dato
      </span>
    )
  }
  const v = t.usdAnterior ? variacion(((t.usd - t.usdAnterior) / t.usdAnterior) * 100) : null
  const bv = t.brecha !== null && t.brechaAnterior !== null ? t.brecha - t.brechaAnterior : null

  const contenido = (
    <>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#4a4845] bg-[#3a3936] px-2.5 text-xs whitespace-nowrap text-[#e8e5df]">
        BCV $ <b className="font-semibold text-white tabular-nums">{tasa(t.usd)}</b>
        {v && (
          <span className={cn('tabular-nums', v.sentido === 'sube' ? 'text-[#ff9b8f]' : v.sentido === 'baja' ? 'text-[#8fe0b5]' : 'text-[#cfccc6]')}>{v.texto}</span>
        )}
      </span>
      {!compacta && t.eur !== null && (
        <span className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#4a4845] bg-[#3a3936] px-2.5 text-xs whitespace-nowrap text-[#e8e5df] 2xl:inline-flex">
          € <b className="font-semibold text-white tabular-nums">{tasa(t.eur)}</b>
        </span>
      )}
      {!compacta && t.veParalelo && t.paralelo !== null && (
        <span className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#7a5a2a] bg-[#3a3936] px-2.5 text-xs whitespace-nowrap text-[#e8e5df] xl:inline-flex">
          <IconoCandadito className="h-3.5 w-3.5 text-[#e0b25c]" />
          <span className="sr-only">Uso interno:</span>
          Par. <b className="font-semibold text-white tabular-nums">{tasa(t.paralelo)}</b>
          <span className="text-[#cfccc6]" aria-hidden>·</span>
          <span className="sr-only">brecha</span>
          <b className="font-semibold text-white tabular-nums">{porcentaje(t.brecha)}</b>
        </span>
      )}
    </>
  )

  const detalle = (
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute top-full right-0 z-50 mt-2 w-80 rounded-xl border border-[var(--borde)] bg-white p-3 text-left text-xs leading-relaxed text-marca-700 opacity-0 shadow-xl transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
    >
      <b className="block text-marca-900">BCV · tasa oficial (venta)</b>
      Dólar <b className="tabular-nums">{tasa(t.usd)} Bs</b> · fecha valor {fechaLarga(t.usdFechaValor)}
      {t.usdAnterior !== null && (
        <>
          <br />
          La anterior: {tasa(t.usdAnterior)} Bs {v ? `(${v.texto})` : ''}
        </>
      )}
      {t.eur !== null && (
        <>
          <br />
          Euro <b className="tabular-nums">{tasa(t.eur)} Bs</b> · fecha valor {fechaLarga(t.eurFechaValor)}
        </>
      )}
      <br />
      Capturada {fechaHora(t.usdCapturada)}
      {t.usdVerificada ? ` · ${t.usdVerificada}` : ''}
      <span className="mt-1 block text-marca-500">La tasa que publica el BCV un día rige el día hábil siguiente.</span>
      {t.veParalelo && t.paralelo !== null && (
        <span className="mt-2 block border-t border-[var(--borde)] pt-2">
          <b className="text-marca-900">Paralelo · uso interno</b> {tasa(t.paralelo)} Bs · brecha {porcentaje(t.brecha)}
          {bv !== null ? ` (${bv >= 0 ? '+' : '−'}${porcentaje(Math.abs(bv))} frente al día anterior)` : ''}
          <span className="block text-marca-500">Referencia de mercado, nunca para facturar. Tu lectura queda registrada.</span>
        </span>
      )}
    </span>
  )

  const clase = 'group relative flex shrink-0 items-center gap-1.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
  return enlace ? (
    <Link href="/sistema/finanzas/tasas" className={clase}>
      {/* El nombre es lo que se ve (WCAG 2.5.3), con el contexto en sr-only. */}
      <span className="sr-only">Tasas del día: </span>
      {contenido}
      <span className="sr-only"> bolívares por dólar. Ver el historial</span>
      {detalle}
    </Link>
  ) : (
    <span className={clase} tabIndex={0} role="note">
      {contenido}
      <span className="sr-only"> bolívares por dólar</span>
      {detalle}
    </span>
  )
}

/** La frescura del espejo de JD. Hasta que exista el espejo (DAT-CNX), lo dice. */
export function PuntoJd() {
  return (
    <span
      tabIndex={0}
      role="note"
      className="group relative hidden h-8 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-xs text-[#cfccc6] focus-visible:outline-2 focus-visible:outline-white lg:inline-flex"
      aria-label="Espejo de JD: sin espejo aún"
    >
      <span className="h-2.5 w-2.5 rounded-full border-2 border-[#8d8785]" aria-hidden />
      <span>JD</span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute top-full right-0 z-50 mt-2 w-64 rounded-xl border border-[var(--borde)] bg-white p-3 text-xs leading-relaxed text-marca-700 opacity-0 shadow-xl group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <b className="block text-marca-900">Espejo de JD: sin espejo aún</b>
        Cuando el conector (DAT-CNX) esté operando, aquí verás la hora del último dato y si cuadra con JD.
      </span>
    </span>
  )
}
