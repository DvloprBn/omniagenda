/**
 * Un intervalo es un rango SEMIABIERTO `[start, end)` de milisegundos epoch
 * (UTC). Semiabierto a proposito: es lo que hace que dos bloques pegados
 * NO se traslapen — `[09:00, 10:00)` y `[10:00, 11:00)` son adyacentes,
 * no encimados. Usar `<=` en la comprobacion de traslape (en vez de `<`)
 * es el error clasico que vuelve imposible agendar dos citas seguidas.
 */
export interface Interval {
  /** Milisegundos epoch, INCLUSIVO. */
  readonly start: number;
  /** Milisegundos epoch, EXCLUSIVO. */
  readonly end: number;
}

/** `true` si el intervalo tiene duracion positiva y ambos extremos son finitos. */
export function isValidInterval(i: Interval): boolean {
  return Number.isFinite(i.start) && Number.isFinite(i.end) && i.start < i.end;
}

/** Duracion en milisegundos. Lanza si el intervalo no es valido. */
export function durationMs(i: Interval): number {
  assertValid(i);
  return i.end - i.start;
}

/**
 * `true` si `a` y `b` comparten al menos un instante. Adyacentes
 * (`a.end === b.start`) devuelve `false` — ver nota de arriba.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** `true` si `inner` cabe por completo dentro de `outer` (bordes incluidos). */
export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** `true` si el instante `t` (ms epoch) cae dentro de `[start, end)`. */
export function containsInstant(i: Interval, t: number): boolean {
  return i.start <= t && t < i.end;
}

/** La parte comun de `a` y `b`, o `null` si no se traslapan. */
export function intersection(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start < end ? { start, end } : null;
}

/**
 * Espacio vacio entre `a` y `b`, en milisegundos:
 *   > 0  hay hueco (no se tocan)
 *   = 0  adyacentes exactos
 *   < 0  se traslapan (magnitud del traslape)
 * El orden de los argumentos no importa.
 */
export function gapMs(a: Interval, b: Interval): number {
  if (a.start <= b.start) return b.start - a.end;
  return a.start - b.end;
}

/**
 * Expande (o contrae, si `byMs` es negativo) el intervalo por `byMs` en
 * CADA extremo. Es la primitiva del "colchon de traslado" de Espiral:
 * `expand(cita, 30*60_000)` reserva 30 min antes y despues. Si contraer
 * lo invertiria, colapsa al punto medio (intervalo de duracion 0, que
 * `isValidInterval` luego rechaza — el llamador decide que hacer).
 */
export function expand(i: Interval, byMs: number): Interval {
  const start = i.start - byMs;
  const end = i.end + byMs;
  if (start >= end) {
    const mid = (i.start + i.end) / 2;
    return { start: mid, end: mid };
  }
  return { start, end };
}

function assertValid(i: Interval): void {
  if (!isValidInterval(i)) {
    throw new RangeError(`Intervalo invalido: start=${i.start}, end=${i.end} (se requiere start < end, ambos finitos)`);
  }
}
