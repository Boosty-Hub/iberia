import type { Metadata } from 'next'
import Link from 'next/link'
import { esEditor, requerirPermiso } from '@/lib/auth'
import { KpiMetrica } from '@/lib/plataforma/metricas'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_CERTIFICADOS } from '@/lib/plataforma/tablas-formacion'
import type { LoteTabla } from '@/lib/plataforma/tabla'
import { BOTON_CABECERA, BOTON_CABECERA_PRINCIPAL, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { marcarEntregados } from '../acciones'

export const metadata: Metadata = { title: 'Certificados · Formación' }

/**
 * Los certificados emitidos (`ui.formacion_certificados()`, con la RLS de
 * `certificados`: el equipo o la casilla de Certificados). Se emiten solos al
 * terminar las nueve lecciones, con los datos congelados en la fila. De aquí
 * sale el lote para imprimir —la misma hoja que ve el trabajador en su
 * teléfono— y, para el equipo, la marca de entregado en mano.
 */
export default async function FormacionCertificadosPage({ searchParams }: PageProps<'/sistema/nucleo/formacion/certificados'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:certificados'), searchParams])
  const ctx = await leerContexto(sp)
  const lote: LoteTabla | undefined = esEditor(sesion.perfil)
    ? { nombre: 'nombre', acciones: [{ clave: 'entregar', etiqueta: 'Marcar entregados en mano', principal: true, aplica: 'por_entregar', ejecutar: marcarEntregados }] }
    : undefined
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-FOR"
        migas={[{ etiqueta: 'Certificados' }]}
        acciones={
          <>
            <Link href="/sistema/nucleo/formacion/certificados/imprimir?entregado=no" className={BOTON_CABECERA}>
              Imprimir los que faltan por entregar
            </Link>
            <Link href="/sistema/nucleo/formacion/certificados/imprimir" className={BOTON_CABECERA_PRINCIPAL}>
              Imprimir todos
            </Link>
          </>
        }
        descripcion="Se emiten solos cuando alguien termina las nueve lecciones. El Gerente de Planta los entrega impresos, en mano: salen uno por hoja, con la misma maqueta que ve el trabajador en su teléfono."
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="formacion_certificados" ctx={ctx} sesion={sesion} titulo="Emitidos" />
        <KpiMetrica
          clave="formacion_certificados"
          ctx={ctx}
          sesion={sesion}
          parte={{ detalle: 'sin_entregar', titulo: 'Por entregar en mano', texto: 'Impresos y por llevarle a cada quien', href: '/sistema/nucleo/formacion/certificados?f.entregado=no' }}
        />
      </div>
      <TablaServidor fuente={TABLA_CERTIFICADOS} sp={sp} sesion={sesion} ctx={ctx} lote={lote} vacio="Todavía no hay ninguno. Se emiten solos cuando alguien termina las nueve lecciones." />
    </>
  )
}
