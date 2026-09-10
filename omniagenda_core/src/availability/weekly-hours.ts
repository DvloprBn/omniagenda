import type { Interval } from '../time/interval.js';
import { intersection } from '../time/interval.js';
import { wallPartsInZone, instantFromWall, startOfDayInZone, addDaysInZone } from '../time/zoned.js';

/** Horario de un dia: "HH:MM" a "HH:MM", hora de pared. */
export interface DayHours {
  open: string;
  close: string;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/**
 * Patron semanal recurrente por (recurso, calendario). Un dia ausente o
 * en `null` = cerrado. Misma forma que `artist_locations.weekly_hours` de
 * Espiral. Se valida en la aplicacion (aqui), no en la base.
 */
export type WeeklyHours = Partial<Record<DayKey, DayHours | null>>;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHHMM(value: string, label: string): { hour: number; minute: number } {
  const m = HHMM.exec(value);
  if (!m) throw new RangeError(`Hora "${value}" invalida en ${label} — se espera "HH:MM" 24h`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/**
 * Expande el patron semanal en intervalos concretos de "abierto" que
 * cubren `window`, interpretando "HH:MM" como hora de pared en `timeZone`.
 *
 * Fase 1 NO soporta rangos que cruzan la medianoche (`close` <= `open`):
 * se lanza un error. Espiral tampoco los soporta; se agrega cuando un
 * caso real (un bar que cierra a las 02:00) lo pida.
 */
export function expandWeeklyHours(weekly: WeeklyHours, window: Interval, timeZone: string): Interval[] {
  if (!(window.start < window.end)) return [];

  const out: Interval[] = [];
  // Arrancar en la medianoche local del dia en que cae window.start y
  // avanzar dia por dia hasta pasar window.end.
  let dayStart = startOfDayInZone(window.start, timeZone);
  const guard = 1000; // ~2.7 años de ventana como tope de seguridad
  let steps = 0;

  while (dayStart < window.end) {
    if (++steps > guard) throw new Error('expandWeeklyHours: ventana demasiado grande (> 1000 dias)');
    const parts = wallPartsInZone(dayStart, timeZone);
    const key = DAY_KEYS[parts.weekday];
    const hours = key ? weekly[key] : null;

    if (hours) {
      const o = parseHHMM(hours.open, `${key}.open`);
      const c = parseHHMM(hours.close, `${key}.close`);
      const openInstant = instantFromWall({ year: parts.year, month: parts.month, day: parts.day, hour: o.hour, minute: o.minute }, timeZone);
      const closeInstant = instantFromWall({ year: parts.year, month: parts.month, day: parts.day, hour: c.hour, minute: c.minute }, timeZone);
      if (!(openInstant < closeInstant)) {
        throw new RangeError(`Horario de ${key}: "${hours.open}"–"${hours.close}" no es un rango valido dentro del mismo dia`);
      }
      const clipped = intersection({ start: openInstant, end: closeInstant }, window);
      if (clipped) out.push(clipped);
    }

    dayStart = addDaysInZone(dayStart, 1, timeZone);
  }

  return out;
}
