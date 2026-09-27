import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { fechaLarga, identificacion, legible, TEXTOS, type DatosCertificado } from '@/lib/certificado'

/**
 * El certificado en imagen: el que se guarda en el teléfono, el que se manda
 * por WhatsApp y el que se publica en el canal.
 *
 * La hoja HTML (`components/certificado-hoja.tsx`) sirve para la pantalla y el
 * impreso, pero de una página no se guarda nada en la galería ni se comparte
 * nada por WhatsApp: hace falta un archivo. Esto lo dibuja con `next/og` en el
 * momento, con la misma letra de la aplicación (DM Sans, en `assets/fuentes/`,
 * licencia OFL), el logo de Industrias Iberia y Ajito. El texto sale de
 * `lib/certificado.ts`, el mismo de la hoja.
 *
 * ⚠️ **La que va al canal no lleva la cédula** (`conCedula: false`). El feed lo
 * leen las doscientas personas de Iberia; la que se guarda o se manda a alguien
 * sí la lleva, porque es de quien la tiene.
 *
 * Los archivos se leen del disco con `process.cwd()`, como enseña la guía de
 * `ImageResponse`, y `next.config.ts` los mete en la función de Netlify
 * (`outputFileTracingIncludes`): allá la función no ve `public/` si no se le dice.
 */

export const ANCHO = 1080
export const ALTO = 1440

const TINTA = '#1e1c1b' // marca-900
const TEXTO = '#474342' // marca-700
const SUAVE = '#6d6765' // marca-500
const ROTULO = '#8d8785' // marca-400
const LINEA = '#dbd8d7' // marca-200
const ROJO = '#bd2a23' // acento-600
const MARCO = '#f7c8c4' // acento-200

type Recursos = {
  fuentes: { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }[]
  iberia: string
  ajito: string
}

let recursos: Promise<Recursos> | null = null

function cargar(): Promise<Recursos> {
  recursos ??= (async () => {
    const raiz = process.cwd()
    const fuente = (peso: 400 | 600 | 700) =>
      readFile(join(raiz, 'assets', 'fuentes', `dm-sans-latin-${peso}-normal.woff`)).then(
        (data) => ({ name: 'DM Sans', data, weight: peso, style: 'normal' as const })
      )
    const png = (archivo: string) =>
      readFile(join(raiz, 'public', 'marca', archivo)).then(
        (b) => `data:image/png;base64,${b.toString('base64')}`
      )
    const [f400, f600, f700, iberia, ajito] = await Promise.all([
      fuente(400),
      fuente(600),
      fuente(700),
      png('iberia.png'),
      png('ajito.png'),
    ])
    return { fuentes: [f400, f600, f700], iberia, ajito }
  })()
  // Si falla una vez —un archivo que no llegó a la función—, que la próxima
  // petición lo vuelva a intentar en vez de quedarse con la promesa rota.
  recursos.catch(() => {
    recursos = null
  })
  return recursos
}

/**
 * Un párrafo con palabras en negrita, partido en palabras.
 *
 * `next/og` pone cada hijo de un contenedor como una caja aparte: un `<strong>`
 * en medio de la frase salía como un bloque suelto y la frase se partía por
 * donde no era. Con cada palabra en su caja, el renglón se llena como un texto.
 */
function palabras(trozos: { texto: string; negrita?: boolean }[]) {
  return trozos.flatMap(({ texto, negrita }, i) =>
    texto
      .split(/\s+/)
      .filter(Boolean)
      .map((palabra, j) => (
        <span
          key={`${i}-${j}`}
          style={{
            marginRight: 11,
            fontWeight: negrita ? 600 : 400,
            color: negrita ? TINTA : TEXTO,
          }}
        >
          {palabra}
        </span>
      ))
  )
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline' }}>
      <div
        style={{
          width: 170,
          flexShrink: 0,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: ROTULO,
        }}
      >
        {rotulo}
      </div>
      <div style={{ flex: 1, fontSize: 38, color: TINTA, lineHeight: 1.3 }}>{valor}</div>
    </div>
  )
}

export async function imagenCertificado(
  certificado: DatosCertificado,
  { conCedula }: { conCedula: boolean }
): Promise<ImageResponse> {
  const { fuentes, iberia, ajito } = await cargar()
  // Un nombre de cuatro palabras no cabe en un renglón a 76: baja la letra y se
  // parte en dos, sin empujar el pie fuera de la hoja.
  const largo = certificado.nombre_completo.length > 20

  const datos: [string, string][] = [
    ...(certificado.cargo ? [[TEXTOS.cargo, legible(certificado.cargo)] as [string, string]] : []),
    ...(certificado.area_nombre ? [[TEXTOS.area, certificado.area_nombre] as [string, string]] : []),
    [TEXTOS.fecha, fechaLarga(certificado.emitido_en)],
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 44,
          background: '#ffffff',
          fontFamily: 'DM Sans',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            border: `4px solid ${MARCO}`,
            borderRadius: 44,
            padding: '76px 80px 64px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- lo dibuja next/og, no el navegador */}
            <img src={iberia} width={290} height={75} alt="" />
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 6,
                textTransform: 'uppercase',
                color: ROJO,
              }}
            >
              {TEXTOS.marca}
            </div>
          </div>

          <div style={{ marginTop: 72, fontSize: 36, color: SUAVE, flexShrink: 0 }}>{TEXTOS.certifica}</div>
          <div
            style={{
              marginTop: 14,
              fontSize: largo ? 62 : 76,
              fontWeight: 700,
              lineHeight: 1.1,
              color: TINTA,
              flexShrink: 0,
            }}
          >
            {certificado.nombre_completo}
          </div>
          {/* En el canal no va ni la cédula ni la ficha: son de la persona. */}
          {conCedula && identificacion(certificado) && (
            <div style={{ marginTop: 14, fontSize: 36, color: SUAVE, flexShrink: 0 }}>{identificacion(certificado)}</div>
          )}

          <div
            style={{
              marginTop: 46,
              marginBottom: 46,
              width: 170,
              height: 14,
              borderRadius: 7,
              background: ROJO,
              flexShrink: 0,
            }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: 40, lineHeight: 1.5, flexShrink: 0 }}>
            {palabras([
              { texto: TEXTOS.completo },
              { texto: `${TEXTOS.curso},`, negrita: true },
              { texto: TEXTOS.detalle },
              { texto: `${TEXTOS.programa},`, negrita: true },
              { texto: TEXTOS.dictado },
            ])}
          </div>

          <div
            style={{
              marginTop: 48,
              paddingTop: 40,
              borderTop: `3px solid ${LINEA}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              flexShrink: 0,
            }}
          >
            {datos.map(([rotulo, valor]) => (
              <Dato key={rotulo} rotulo={rotulo} valor={valor} />
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              paddingTop: 36,
              borderTop: `3px solid ${LINEA}`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: ROTULO,
                }}
              >
                {TEXTOS.codigo}
              </div>
              <div style={{ marginTop: 6, fontSize: 46, fontWeight: 600, color: TINTA }}>
                {certificado.codigo}
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- lo dibuja next/og, no el navegador */}
            <img src={ajito} width={170} height={170} alt="" />
          </div>
        </div>
      </div>
    ),
    { width: ANCHO, height: ALTO, fonts: fuentes }
  )
}
