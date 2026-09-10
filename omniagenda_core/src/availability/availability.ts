import type { Interval } from '../time/interval.js';
import { subtract, expandEach, dropShorterThan, normalize } from '../time/interval-set.js';
import type { WeeklyHours } from './weekly-hours.js';
import { expandWeeklyHours } from './weekly-hours.js';

export interface AvailabilityQuery {
  /** Ventana de interes (ej. la semana que se esta mirando). */
  window: Interval;
  /** Zona IANA del calendario. */
  timeZone: string;
  /** Patron semanal de apertura. */
  weeklyHours: WeeklyHours;
  /** Ausencias / bloqueos por rango (vacaciones, dia festivo, mantenimiento). */
  timeOff?: readonly Interval[];
  /** Reservas que ya ocupan (deben venir ya filtradas a las que bloquean). */
  busy?: readonly Interval[];
  /** Colchon: expande cada `busy` por estos minutos antes de restarlo. */
  bufferMinutes?: number;
  /** Descarta huecos libres mas cortos que esto. */
  minSlotMinutes?: number;
}

/**
 * Los tramos LIBRES dentro de `window`:
 *   apertura semanal  −  ausencias  −  (reservas + colchon)  →  filtrar cortos.
 *
 * Todo es composicion de operaciones puras de conjuntos de intervalos;
 * no reserva nada ni conoce el negocio.
 */
export function computeAvailability(q: AvailabilityQuery): Interval[] {
  const open = expandWeeklyHours(q.weeklyHours, q.window, q.timeZone);

  const blockers: Interval[] = [
    ...normalize(q.timeOff ?? []),
    ...expandEach(q.busy ?? [], (q.bufferMinutes ?? 0) * 60_000),
  ];

  let free = subtract(open, blockers);

  if (q.minSlotMinutes && q.minSlotMinutes > 0) {
    free = dropShorterThan(free, q.minSlotMinutes * 60_000);
  }
  return free;
}
