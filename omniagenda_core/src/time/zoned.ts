/**
 * El puente entre "hora de reloj de pared" y "instante" (ms epoch), con
 * zona horaria EXPLICITA. Todo el calendario pasa por aqui — nunca por
 * `Date.prototype.getHours()` a secas, que depende de la zona del proceso
 * (en un contenedor sin `TZ`, UTC). Sin librerias: solo `Intl`, que en
 * Node 24 trae ICU completo.
 *
 * Ver PLAN_DESARROLLO.md §1 (principio 3) y DOCUMENTO_VIVO_ARQUITECTURA.md §5.
 */

export interface WallTime {
  /** Año completo, ej. 2026. */
  year: number;
  /** Mes 1-12 (NO 0-11). */
  month: number;
  /** Dia del mes 1-31. */
  day: number;
  /** Hora 0-23. */
  hour: number;
  /** Minuto 0-59. */
  minute: number;
  /** Segundo 0-59. Opcional, default 0. */
  second?: number;
}

export interface WallParts extends Required<WallTime> {
  /** 0=domingo .. 6=sabado (misma convencion que `Date.prototype.getUTCDay`). */
  weekday: number;
}

const PART_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = PART_FORMATTER_CACHE.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    PART_FORMATTER_CACHE.set(timeZone, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Partes de reloj de pared de un instante, vistas en `timeZone`. */
export function wallPartsInZone(instant: number, timeZone: string): WallParts {
  const parts = partsFormatter(timeZone).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const p = parts.find((x) => x.type === type);
    if (!p) throw new Error(`Intl no devolvio la parte "${type}" para la zona "${timeZone}"`);
    return p.value;
  };
  const weekdayName = get('weekday');
  const weekday = WEEKDAY_INDEX[weekdayName];
  if (weekday === undefined) throw new Error(`Dia de semana no reconocido: "${weekdayName}"`);
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24, // "24:00" -> 0 en algunos ICU
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday,
  };
}

/**
 * Offset de `timeZone` en el instante dado, en MINUTOS respecto a UTC
 * (ej. -360 para el centro de Mexico en invierno). Positivo al este de
 * Greenwich, negativo al oeste.
 */
export function zoneOffsetMinutes(instant: number, timeZone: string): number {
  const p = wallPartsInZone(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asIfUtc - instant) / 60_000);
}

/**
 * El instante en que ocurre la hora de pared `wall` en `timeZone`.
 *
 * Metodo: se supone `wall` como si fuera UTC, se mide el offset real de la
 * zona en ese punto y se corrige; una segunda medicion atrapa el caso en
 * que la correccion cruzo un cambio de horario de verano.
 *
 * Salvedad DST, documentada a proposito: en el hueco de "adelantar el
 * reloj" (una hora que no existe) el resultado cae en el instante justo
 * despues del salto; en el solapamiento de "atrasar el reloj" (una hora
 * que ocurre dos veces) resuelve a la PRIMERA ocurrencia. Las verticales
 * de referencia (Mexico) no usan horario de verano desde 2022, asi que
 * este caso no las toca; se deja correcto-y-acotado para zonas que si.
 */
export function instantFromWall(wall: WallTime, timeZone: string): number {
  const second = wall.second ?? 0;
  const naiveUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, second);
  const offset1 = zoneOffsetMinutes(naiveUtc, timeZone);
  let guess = naiveUtc - offset1 * 60_000;
  const offset2 = zoneOffsetMinutes(guess, timeZone);
  if (offset2 !== offset1) {
    guess = naiveUtc - offset2 * 60_000;
  }
  return guess;
}

/** Medianoche (00:00 hora de pared) del dia de `instant`, en `timeZone`. */
export function startOfDayInZone(instant: number, timeZone: string): number {
  const p = wallPartsInZone(instant, timeZone);
  return instantFromWall({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** Suma `days` dias de CALENDARIO (hora de pared preservada) en `timeZone`. */
export function addDaysInZone(instant: number, days: number, timeZone: string): number {
  const p = wallPartsInZone(instant, timeZone);
  return instantFromWall(
    { year: p.year, month: p.month, day: p.day + days, hour: p.hour, minute: p.minute, second: p.second },
    timeZone,
  );
}
