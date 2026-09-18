"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * El mapa de procesos, navegable.
 *
 * Es la forma canónica de un mapa de procesos y no un organigrama: los
 * **estratégicos arriba**, la **cadena operativa en el medio y en flujo** —de
 * la planificación a la venta, que es el orden en que el producto atraviesa la
 * empresa— y los **de soporte abajo**, sosteniendo a los otros dos. Esa figura
 * dice algo que una lista no dice: dónde está el valor y quién lo sostiene.
 *
 * Cada caja es un macroproceso. Al abrirla salen sus procesos de primer nivel,
 * y cada uno lleva a su ficha en el informe.
 *
 * ⚠️ **No hay ancla por proceso en el informe.** Las fichas son por
 * macroproceso y los procesos viven dentro, como filas de una tabla — y las
 * tablas no producen anclas. Por eso el enlace va a la ficha del macroproceso
 * **más `?proceso=`**, que la página de fichas usa para resaltar la fila. Es lo
 * que hace que «ir al proceso» lleve al proceso y no al principio de la ficha.
 */

export type ProcesoDelMapa = {
  nombre: string;
  estado: string;
  area: string | null;
  dueno_corregido: boolean;
};

export type MacroDelMapa = {
  nivel: string;
  numero: number;
  nombre: string;
  nuevo: boolean;
  ancla: string;
  procesos: ProcesoDelMapa[];
};

const NO_SE_DIBUJA = new Set(["NO SE EJECUTA", "SIN EVIDENCIA"]);

/** El orden de las bandas, y su tinte. Es el mismo de las fichas. */
const BANDAS = [
  { nivel: "Estratégico", clase: "banda-estrategico", rotulo: "Dirigen" },
  { nivel: "Operativo", clase: "banda-operativo", rotulo: "Crean el valor" },
  { nivel: "Soporte", clase: "banda-soporte", rotulo: "Sostienen" },
];

export function MapaInteractivo({ macros }: { macros: MacroDelMapa[] }) {
  // Cuál está abierto. Uno a la vez: con dos o tres abiertos la figura del mapa
  // —que es la mitad de lo que este dibujo comunica— deja de verse.
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <div className="mapa">
      {BANDAS.map(({ nivel, clase, rotulo }) => {
        const suyos = macros.filter((m) => m.nivel === nivel);
        if (!suyos.length) return null;
        const n = BANDAS.findIndex((b) => b.nivel === nivel) + 1;

        return (
          <section key={nivel} className={`mapa-banda ${clase}`}>
            <header className="mapa-banda-cabecera">
              <span className="mapa-banda-numero">{n}</span>
              <h2 className="mapa-banda-titulo">{nivel}</h2>
              <span className="mapa-banda-rotulo">{rotulo}</span>
              <span className="mapa-banda-cuenta">
                {suyos.length}{" "}
                {suyos.length === 1 ? "macroproceso" : "macroprocesos"}
              </span>
            </header>

            {/* La cadena operativa se dibuja en flujo: las cajas llevan flecha
                entre una y otra y la fila se desplaza en horizontal si no cabe.
                Las otras dos bandas no son secuencia y van en rejilla — ponerles
                flecha diría que hay un orden donde no lo hay. */}
            <div
              className={nivel === "Operativo" ? "mapa-cadena" : "mapa-rejilla"}
            >
              {suyos.map((m) => {
                const clave = `${m.nivel}-${m.numero}`;
                const visibles = m.procesos.filter(
                  (p) => !NO_SE_DIBUJA.has(p.estado),
                );
                const fuera = m.procesos.length - visibles.length;
                const esta = abierto === clave;

                return (
                  // ⚠️ La flecha de la cadena va en el envoltorio, no en la caja.
                  // Dibujada dentro, la caja tiene que ser una fila y al abrirse
                  // el cuerpo se le pone al lado del título en vez de debajo.
                  <div
                    key={clave}
                    className={`mapa-eslabon${esta ? " abierto" : ""}`}
                  >
                    <article className={`mapa-caja${esta ? " abierta" : ""}`}>
                      <button
                        type="button"
                        className="mapa-caja-cabeza"
                        aria-expanded={esta}
                        onClick={() => setAbierto(esta ? null : clave)}
                      >
                        <span className="mapa-caja-numero">
                          {n}.{m.numero}
                        </span>
                        <span className="mapa-caja-nombre">{m.nombre}</span>
                        <span className="mapa-caja-pie">
                          {m.nuevo && <span className="mapa-nuevo">nuevo</span>}
                          <span className="mapa-caja-cuenta">
                            {visibles.length}
                          </span>
                        </span>
                      </button>

                      {esta && (
                        <div className="mapa-caja-cuerpo">
                          <ol className="mapa-procesos">
                            {visibles.map((p, i) => (
                              <li key={`${p.nombre}-${i}`}>
                                <Link
                                  href={`/informe/fichas-procesos?proceso=${encodeURIComponent(p.nombre)}#${m.ancla}`}
                                  className="mapa-proceso"
                                >
                                  <span className="mapa-proceso-numero">
                                    {n}.{m.numero}.{i + 1}
                                  </span>
                                  <span className="mapa-proceso-nombre">
                                    {p.nombre}
                                    {p.estado === "NUEVO" && (
                                      <em className="mapa-etiqueta">nuevo</em>
                                    )}
                                    {p.dueno_corregido && (
                                      <em className="mapa-etiqueta">
                                        dueño corregido
                                      </em>
                                    )}
                                  </span>
                                  {p.area && (
                                    <span className="mapa-proceso-area">
                                      {p.area}
                                    </span>
                                  )}
                                </Link>
                              </li>
                            ))}
                          </ol>

                          {/* Lo que no se ejecuta no se dibuja como proceso —no lo
                            es— pero tampoco se esconde: es hallazgo, y está al
                            pie de su ficha. */}
                          {fuera > 0 && (
                            <p className="mapa-fuera">
                              {fuera}{" "}
                              {fuera === 1
                                ? "proceso documentado que no se ejecuta"
                                : "procesos documentados que no se ejecutan o sin evidencia"}
                              {" · "}
                              <Link
                                href={`/informe/fichas-procesos#${m.ancla}`}
                              >
                                al pie de la ficha
                              </Link>
                            </p>
                          )}

                          <Link
                            href={`/informe/fichas-procesos#${m.ancla}`}
                            className="mapa-ficha"
                          >
                            Ver la ficha completa →
                          </Link>
                        </div>
                      )}
                    </article>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
