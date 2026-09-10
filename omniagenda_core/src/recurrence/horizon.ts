import type { Interval } from '../time/interval.js';

/**
 * ── RIESGO #1 (DOCUMENTO_VIVO_ARQUITECTURA.md §8), cerrado aqui ──
 *
 * El `EXCLUDE USING gist` de PostgreSQL (Fase 2) solo puede mirar FILAS
 * REALES. Una serie recurrente se guarda como UNA regla, no como miles de
 * filas — asi que sus ocurrencias son "virtuales" y el motor de la base
 * de datos no las ve. Una ocurrencia recurrente que DEBE bloquear el
 * calendario tiene que materializarse (ganar fila real) dentro de un
 * horizonte finito; un cron la va extendiendo.
 *
 * Elegir el horizonte es una compensacion real:
 *   - Muy corto  -> una cita recurrente lejana (ej. "clase todos los
 *     martes") no protege su horario contra una reserva puntual hecha con
 *     mucha anticipacion: la base no la ve todavia.
 *   - Muy largo   -> muchas filas por serie, indices mas grandes, el cron
 *     de materializacion tarda mas en cada corrida.
 *
 * DECISION (Fase 1): 90 dias. Cubre con margen la ventana en que un
 * humano agenda por adelantado en los verticales de referencia
 * (restaurante, estetica, tatuajes) sin inflar la tabla. Se REVISA en la
 * Fase 2 con medicion real sobre datos sembrados, no antes. Vive aqui,
 * en una sola constante, para que el cron, el calculo de disponibilidad y
 * cualquier prueba lean el mismo numero.
 *
 * Las ocurrencias MAS ALLA del horizonte siguen siendo visibles en el
 * calendario (se expanden al vuelo con `expandRecurrence`); lo unico que
 * no tienen todavia es la garantia dura del `EXCLUDE`. El pre-chequeo de
 * la aplicacion (`evaluateConflict`) SI las considera — ver conflict.ts.
 */
export const MATERIALIZATION_HORIZON_DAYS = 90;

/** El mismo horizonte en milisegundos. */
export const MATERIALIZATION_HORIZON_MS = MATERIALIZATION_HORIZON_DAYS * 24 * 60 * 60 * 1000;

/**
 * La ventana `[ahora, ahora + horizonte)` dentro de la cual el cron
 * materializa ocurrencias recurrentes que bloquean.
 */
export function materializationWindow(now: number): Interval {
  return { start: now, end: now + MATERIALIZATION_HORIZON_MS };
}
