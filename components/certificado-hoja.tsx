import Image from 'next/image'

/**
 * La hoja del certificado.
 *
 * Vive en un componente y no dentro de la página porque la mira dos públicos
 * distintos: el trabajador en su teléfono, y quien en Boosty va a imprimir los
 * doscientos. Si fueran dos maquetas, el papel y la pantalla dirían cosas
 * distintas del mismo curso, y el papel es el que queda.
 *
 * **Lo que muestra sale de la fila, no del padrón.** Nombre, cédula, cargo y
 * área quedaron congelados el día de la emisión: si la persona cambia de puesto
 * en noviembre, el certificado sigue diciendo lo que era cuando lo hizo.
 */
export type Certificado = {
  codigo: string
  nombre_completo: string
  cedula: string
  cargo: string | null
  area_nombre: string | null
  emitido_en: string
}

export function CertificadoHoja({ certificado }: { certificado: Certificado }) {
  return (
    // `data-certificado` no pinta nada: por ahí lo recorta `generar:certificados`
    // para mandarlo a imprimir, y por ahí lo comprueba `probar:certificado`.
    <article
      data-certificado={certificado.codigo}
      className="tarjeta-canal overflow-hidden px-6 py-8"
    >
      <header className="flex items-center justify-between gap-4">
        <Image
          src="/marca/iberia.png"
          alt="Industrias Iberia"
          width={420}
          height={140}
          priority
          className="h-8 w-auto object-contain"
        />
        <span className="text-[11px] font-bold tracking-[0.18em] text-acento-600 uppercase">
          Nuevo Sabor
        </span>
      </header>

      <p className="mt-8 text-[13px] leading-relaxed text-marca-500">
        Industrias Iberia certifica que
      </p>

      <h1 className="mt-1 text-[26px] leading-tight font-bold text-balance text-marca-900">
        {certificado.nombre_completo}
      </h1>

      <p className="mt-1 text-[14px] text-marca-500">C.I. {certificado.cedula}</p>

      <div className="my-6 h-1.5 w-20 rounded-full bg-acento-600" />

      <p className="text-[15px] leading-relaxed text-marca-700">
        completó el adiestramiento{' '}
        <strong className="font-semibold text-marca-900">
          Inteligencia artificial en tu puesto
        </strong>
        , nueve lecciones del programa <strong className="font-semibold">Nuevo Sabor</strong>,
        dictadas por Ajito.
      </p>

      <dl className="mt-7 space-y-3 border-t border-marca-200/70 pt-6">
        {certificado.cargo && <Dato rotulo="Cargo" valor={certificado.cargo} />}
        {certificado.area_nombre && <Dato rotulo="Área" valor={certificado.area_nombre} />}
        <Dato rotulo="Fecha" valor={fechaLarga(certificado.emitido_en)} />
      </dl>

      <footer className="mt-7 flex items-end justify-between gap-4 border-t border-marca-200/70 pt-6">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.12em] text-marca-400 uppercase">
            Código
          </p>
          {/* Alguien de Capital Humano lo va a teclear copiándolo del impreso. */}
          <p className="mt-0.5 font-mono text-[17px] font-semibold tracking-tight text-marca-900">
            {certificado.codigo}
          </p>
        </div>
        <Image
          src="/marca/ajito.png"
          alt=""
          width={200}
          height={200}
          className="h-20 w-20 shrink-0 object-contain"
        />
      </footer>
    </article>
  )
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-16 shrink-0 text-[11px] font-bold tracking-[0.12em] text-marca-400 uppercase">
        {rotulo}
      </dt>
      <dd className="min-w-0 flex-1 text-[15px] text-marca-800">{valor}</dd>
    </div>
  )
}

export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
