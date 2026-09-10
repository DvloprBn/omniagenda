import type { Interval } from './interval.js';
import { isValidInterval, expand } from './interval.js';

/**
 * Ordena por inicio, descarta los invalidos y FUSIONA los que se traslapan
 * o se tocan (`end === start`) en uno solo. Devuelve un conjunto disjunto,
 * ordenado y sin adyacencias — la forma canonica que esperan las demas
 * operaciones de este archivo.
 */
export function normalize(intervals: readonly Interval[]): Interval[] {
  const valid = intervals.filter(isValidInterval).slice().sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const cur of valid) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) {
      // Se traslapan o se tocan -> extender el ultimo.
      if (cur.end > last.end) out[out.length - 1] = { start: last.start, end: cur.end };
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}

/** Union: `normalize` de la concatenacion. */
export function union(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  return normalize([...a, ...b]);
}

/**
 * Resta: de cada intervalo de `from`, saca los pedazos cubiertos por
 * cualquier intervalo de `remove`. Un `remove` en medio parte el intervalo
 * en dos. Ambas entradas se normalizan primero.
 */
export function subtract(from: readonly Interval[], remove: readonly Interval[]): Interval[] {
  const holes = normalize(remove);
  const out: Interval[] = [];
  for (const base of normalize(from)) {
    let cursor = base.start;
    for (const hole of holes) {
      if (hole.end <= cursor) continue;
      if (hole.start >= base.end) break;
      if (hole.start > cursor) out.push({ start: cursor, end: Math.min(hole.start, base.end) });
      cursor = Math.max(cursor, hole.end);
      if (cursor >= base.end) break;
    }
    if (cursor < base.end) out.push({ start: cursor, end: base.end });
  }
  return out;
}

/** Interseccion de dos conjuntos: los tramos que estan en AMBOS. */
export function intersect(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const bn = normalize(b);
  const out: Interval[] = [];
  for (const ia of normalize(a)) {
    for (const ib of bn) {
      const start = Math.max(ia.start, ib.start);
      const end = Math.min(ia.end, ib.end);
      if (start < end) out.push({ start, end });
    }
  }
  return normalize(out);
}

/** Los tramos LIBRES dentro de `window` una vez quitado todo lo `busy`. */
export function freeWithin(window: Interval, busy: readonly Interval[]): Interval[] {
  return subtract([window], busy);
}

/** Suma de las duraciones (tras normalizar, asi el solape no se cuenta dos veces). */
export function totalDurationMs(intervals: readonly Interval[]): number {
  return normalize(intervals).reduce((acc, i) => acc + (i.end - i.start), 0);
}

/** Expande cada intervalo por `byMs` en cada extremo y re-normaliza. */
export function expandEach(intervals: readonly Interval[], byMs: number): Interval[] {
  return normalize(intervals.map((i) => expand(i, byMs)));
}

/** Descarta los tramos mas cortos que `minMs`. */
export function dropShorterThan(intervals: readonly Interval[], minMs: number): Interval[] {
  return intervals.filter((i) => i.end - i.start >= minMs);
}
