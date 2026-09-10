import type { Interval } from '../time/interval.js';
import { overlaps } from '../time/interval.js';
import { wallPartsInZone, instantFromWall } from '../time/zoned.js';

/**
 * Subconjunto de RRULE (RFC 5545) que cubre lo que un negocio de
 * reservaciones de verdad necesita. Lo que NO se soporta a proposito en
 * Fase 1 (se agrega cuando un caso real lo pida): FREQ=YEARLY/HOURLY,
 * BYMONTH, BYSETPOS, BYWEEKNO, semanas que no empiezan en lunes.
 *
 * La recurrencia avanza en terminos de RELOJ DE PARED en `timeZone`, no
 * en saltos fijos de 24 h: "todos los dias a las 09:00" sigue siendo a
 * las 09:00 aunque en medio haya un cambio de horario de verano.
 */
export interface RecurrenceRule {
  /** Instante (ms epoch) de inicio de la PRIMERA ocurrencia (equivale a DTSTART). */
  dtStart: number;
  /** Duracion de cada ocurrencia en ms; `end = start + durationMs`. */
  durationMs: number;
  /** Zona IANA en que esta anclada la serie, ej. "America/Mexico_City". */
  timeZone: string;
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  /** Cada cuantas unidades de `freq`. Default 1. Debe ser entero >= 1. */
  interval?: number;
  /** Solo WEEKLY: dias de la semana (0=domingo..6=sabado). Default: el dia de `dtStart`. */
  byWeekday?: readonly number[];
  /** Solo MONTHLY: dias del mes (1-31). El 31 se recorta al ultimo dia real del mes. Default: el dia de `dtStart`. */
  byMonthDay?: readonly number[];
  /** Tope de ocurrencias TOTALES de la serie (antes de aplicar EXDATE). */
  count?: number;
  /** Ultimo instante (inclusive) en que una ocurrencia puede EMPEZAR. */
  until?: number;
  /** Instantes de inicio a saltar (comparacion exacta). Equivale a EXDATE. */
  exDates?: readonly number[];
}

export interface Occurrence {
  start: number;
  end: number;
  /** Indice 0-based en la serie, ANTES de filtrar por EXDATE. */
  index: number;
}

/** Tope de seguridad: una regla mal formada no debe poder colgar el proceso. */
const MAX_ITERATIONS = 20_000;

/**
 * Expande la serie DENTRO de `window` (nunca "hasta el infinito": la
 * ventana es obligatoria y acota el trabajo). Devuelve las ocurrencias
 * cuyo `[start, end)` se traslapa con `window`, en orden cronologico, ya
 * sin las que caen en `exDates`.
 */
export function expandRecurrence(rule: RecurrenceRule, window: Interval): Occurrence[] {
  const interval = rule.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new RangeError(`RecurrenceRule.interval debe ser entero >= 1 (se recibio ${String(rule.interval)})`);
  }
  if (!(rule.durationMs > 0)) {
    throw new RangeError(`RecurrenceRule.durationMs debe ser > 0 (se recibio ${String(rule.durationMs)})`);
  }

  const exSet = new Set(rule.exDates ?? []);
  const anchor = wallPartsInZone(rule.dtStart, rule.timeZone);
  const out: Occurrence[] = [];

  let index = 0;
  let emitted = 0;
  let iterations = 0;

  // Generador de "starts candidatos" segun la frecuencia.
  const starts = candidateStarts(rule, anchor);

  for (const start of starts) {
    if (++iterations > MAX_ITERATIONS) {
      throw new Error(`expandRecurrence supero ${MAX_ITERATIONS} iteraciones — regla probablemente mal formada`);
    }
    if (rule.count !== undefined && emitted >= rule.count) break;
    if (rule.until !== undefined && start > rule.until) break;
    // Una vez que las ocurrencias arrancan despues del fin de la ventana,
    // ya no puede haber ninguna util (los starts van en aumento).
    if (start >= window.end) break;

    const currentIndex = index++;
    emitted++;

    if (exSet.has(start)) continue;

    const occ: Occurrence = { start, end: start + rule.durationMs, index: currentIndex };
    if (overlaps(occ, window)) out.push(occ);
  }

  return out;
}

/**
 * Iterable perezoso de instantes de inicio candidatos, en orden
 * ascendente, empezando en `dtStart`. No aplica `count`/`until`/`window`
 * — de eso se encarga `expandRecurrence`.
 */
function* candidateStarts(rule: RecurrenceRule, anchor: ReturnType<typeof wallPartsInZone>): Generator<number> {
  const step = rule.interval ?? 1;
  const tz = rule.timeZone;
  const wall = (y: number, mo: number, d: number) =>
    instantFromWall({ year: y, month: mo, day: d, hour: anchor.hour, minute: anchor.minute, second: anchor.second }, tz);

  if (rule.freq === 'DAILY') {
    for (let k = 0; ; k += step) {
      yield wall(anchor.year, anchor.month, anchor.day + k);
    }
  }

  if (rule.freq === 'WEEKLY') {
    const weekdays = [...(rule.byWeekday ?? [anchor.weekday])].sort((a, b) => a - b);
    // Lunes de la semana de dtStart (semana lunes..domingo).
    const mondayOffset = (anchor.weekday + 6) % 7; // dom(0)->6, lun(1)->0, ...
    for (let w = 0; ; w += step) {
      for (const wd of weekdays) {
        const dayOffset = -mondayOffset + ((wd + 6) % 7) + w * 7;
        const t = wall(anchor.year, anchor.month, anchor.day + dayOffset);
        if (t >= rule.dtStart) yield t;
      }
    }
  }

  if (rule.freq === 'MONTHLY') {
    const monthDays = [...(rule.byMonthDay ?? [anchor.day])].sort((a, b) => a - b);
    for (let m = 0; ; m += step) {
      const year = anchor.year + Math.floor((anchor.month - 1 + m) / 12);
      const month = ((anchor.month - 1 + m) % 12) + 1;
      const lastDay = daysInMonth(year, month);
      // Recortar al ultimo dia real y DEDUPLICAR: byMonthDay=[30,31] en un
      // mes de 30 dias colapsa ambos al 30 — no debe emitirse dos veces.
      const clampedDays = [...new Set(monthDays.map((md) => Math.min(md, lastDay)))].sort((a, b) => a - b);
      for (const day of clampedDays) {
        const t = wall(year, month, day);
        if (t >= rule.dtStart) yield t;
      }
    }
  }
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}
