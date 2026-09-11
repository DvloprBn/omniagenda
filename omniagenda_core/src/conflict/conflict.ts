import type { Interval } from '../time/interval.js';
import { overlaps, gapMs } from '../time/interval.js';
import { isBlockingStatus } from './status.js';

/** Una reserva ya existente que ocupa (o no) un recurso en un rango. */
export interface ResourceBooking {
  bookingId: string;
  resourceId: string;
  /**
   * El calendario al que pertenece esta reserva (ej. una sucursal). Solo
   * lo usa `crossCalendarBufferMinutes` — para todo lo demas (traslape,
   * colchon general) el calendario es irrelevante: un recurso no puede
   * estar en dos calendarios a la vez, sin importar cual sea cual.
   */
  calendarId: string;
  interval: Interval;
  status: string;
  /**
   * `false` = un bloque que NO rechaza a otros (una tarea, un apartado
   * tentativo). Se reporta como conflicto BLANDO, nunca duro. El `WHERE`
   * del `EXCLUDE` de la Fase 2 lleva `blocking = true` justamente para
   * esto.
   */
  blocking: boolean;
}

/** La reserva que se quiere crear/mover. Puede necesitar VARIOS recursos a la vez. */
export interface ConflictCandidate {
  resourceIds: readonly string[];
  /** El calendario donde se esta creando esta reserva (ej. la sucursal). */
  calendarId: string;
  interval: Interval;
  /**
   * Colchon minimo en MINUTOS que debe separar esta reserva de CUALQUIER
   * otra del mismo recurso, sin importar el calendario del vecino (ej. el
   * tiempo de limpieza de una mesa entre dos comensales). Es una
   * PREFERENCIA — se reporta como conflicto BLANDO (se avisa, no se
   * rechaza): nada impide fisicamente que alguien decida ignorarlo.
   */
  bufferMinutes?: number;
  /**
   * Colchon minimo en MINUTOS que debe separar esta reserva de otra del
   * mismo recurso CUANDO el vecino es de OTRO calendario (el "colchon de
   * traslado" de Espiral: un artista que cambia de sucursal). A
   * diferencia de `bufferMinutes`, esto es una restriccion FISICA, no una
   * preferencia — nadie puede tele-transportarse — asi que se reporta
   * como conflicto DURO, igual que un traslape real.
   *
   * Simplificacion deliberada: un solo valor para TODA la reserva, no uno
   * por recurso — igual que `bufferMinutes`. Cuando una reserva pide
   * varios recursos con distinto colchon configurado, quien arma el
   * `ConflictCandidate` decide el valor efectivo (ej. el maximo de los
   * recursos involucrados); ver `BookingsService` en el backend.
   */
  crossCalendarBufferMinutes?: number;
  /** No chocar consigo misma al reprogramar: se ignora esta reserva del set `existing`. */
  ignoreBookingId?: string;
}

export interface ConflictReport {
  /** Traslapes con una reserva que bloquea, en un recurso compartido — o una violacion del colchon ENTRE CALENDARIOS (fisicamente imposible). El `EXCLUDE` de la base solo atrapa el primer caso; el segundo es puramente logica de aplicacion. */
  hard: ResourceBooking[];
  /** Traslape con un bloque no-bloqueante, o violacion del colchon GENERAL (preferencia, no imposibilidad). Se avisan, no se rechazan. */
  soft: ResourceBooking[];
  /** `true` si no hay ningun conflicto duro. */
  ok: boolean;
}

/**
 * Evalua la reserva candidata contra las reservas existentes. NO toca
 * base de datos ni conoce el negocio del anfitrion: solo recursos, rangos,
 * calendarios y estados.
 *
 * A diferencia del `EXCLUDE` de PostgreSQL (que solo ve filas reales),
 * esta funcion tambien considera las ocurrencias recurrentes "virtuales"
 * que el llamador haya expandido y pasado en `existing` — por eso el
 * pre-chequeo de la aplicacion cubre el hueco del RIESGO #1
 * (recurrence/horizon.ts) mas alla del horizonte de materializacion.
 */
export function evaluateConflict(
  candidate: ConflictCandidate,
  existing: readonly ResourceBooking[],
): ConflictReport {
  const wanted = new Set(candidate.resourceIds);
  const bufferMs = (candidate.bufferMinutes ?? 0) * 60_000;
  const crossCalendarBufferMs = (candidate.crossCalendarBufferMinutes ?? 0) * 60_000;

  const hard: ResourceBooking[] = [];
  const soft: ResourceBooking[] = [];
  const seenHard = new Set<string>();
  const seenSoft = new Set<string>();
  const pushHard = (b: ResourceBooking) => { if (!seenHard.has(b.bookingId)) { seenHard.add(b.bookingId); hard.push(b); } };
  const pushSoft = (b: ResourceBooking) => { if (!seenSoft.has(b.bookingId)) { seenSoft.add(b.bookingId); soft.push(b); } };

  for (const b of existing) {
    if (candidate.ignoreBookingId !== undefined && b.bookingId === candidate.ignoreBookingId) continue;
    if (!wanted.has(b.resourceId)) continue;
    if (!isBlockingStatus(b.status)) continue;

    if (overlaps(candidate.interval, b.interval)) {
      if (b.blocking) pushHard(b); else pushSoft(b);
      continue;
    }
    if (!b.blocking) continue; // sin traslape y no bloquea -> ningun colchon aplica

    // Sin traslape: revisar los dos colchones posibles.
    const gap = gapMs(candidate.interval, b.interval);
    if (gap < 0) continue; // no debería pasar (overlaps ya lo habría atrapado), defensivo

    const differentCalendar = b.calendarId !== candidate.calendarId;
    if (differentCalendar && gap < crossCalendarBufferMs) {
      pushHard(b); // imposibilidad fisica: no da tiempo de cambiar de sucursal
    } else if (gap < bufferMs) {
      pushSoft(b); // preferencia general (ej. tiempo de limpieza)
    }
  }

  return { hard, soft, ok: hard.length === 0 };
}
