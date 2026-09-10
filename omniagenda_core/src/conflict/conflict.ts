import type { Interval } from '../time/interval.js';
import { overlaps, gapMs } from '../time/interval.js';
import { isBlockingStatus } from './status.js';

/** Una reserva ya existente que ocupa (o no) un recurso en un rango. */
export interface ResourceBooking {
  bookingId: string;
  resourceId: string;
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
  interval: Interval;
  /**
   * Colchon minimo en MINUTOS que debe separar esta reserva de cualquier
   * otra del mismo recurso (el "colchon de traslado" de Espiral). Se
   * evalua solo contra reservas que bloquean.
   */
  bufferMinutes?: number;
  /** No chocar consigo misma al reprogramar: se ignora esta reserva del set `existing`. */
  ignoreBookingId?: string;
}

export interface ConflictReport {
  /** Traslapes con una reserva que bloquea, en un recurso compartido. El `EXCLUDE` de la base los rechazaria. */
  hard: ResourceBooking[];
  /** Traslape con un bloque no-bloqueante, o violacion del colchon. Se avisan, no se rechazan. */
  soft: ResourceBooking[];
  /** `true` si no hay ningun conflicto duro. */
  ok: boolean;
}

/**
 * Evalua la reserva candidata contra las reservas existentes. NO toca
 * base de datos ni conoce el negocio del anfitrion: solo recursos, rangos
 * y estados.
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

  const hard: ResourceBooking[] = [];
  const soft: ResourceBooking[] = [];
  const seenHard = new Set<string>();
  const seenSoft = new Set<string>();

  for (const b of existing) {
    if (candidate.ignoreBookingId !== undefined && b.bookingId === candidate.ignoreBookingId) continue;
    if (!wanted.has(b.resourceId)) continue;
    if (!isBlockingStatus(b.status)) continue;

    if (overlaps(candidate.interval, b.interval)) {
      if (b.blocking) {
        if (!seenHard.has(b.bookingId)) { seenHard.add(b.bookingId); hard.push(b); }
      } else {
        if (!seenSoft.has(b.bookingId)) { seenSoft.add(b.bookingId); soft.push(b); }
      }
      continue;
    }

    // Sin traslape: revisar el colchon, solo contra bloques que bloquean.
    if (bufferMs > 0 && b.blocking) {
      const gap = gapMs(candidate.interval, b.interval);
      if (gap >= 0 && gap < bufferMs) {
        if (!seenSoft.has(b.bookingId)) { seenSoft.add(b.bookingId); soft.push(b); }
      }
    }
  }

  return { hard, soft, ok: hard.length === 0 };
}
