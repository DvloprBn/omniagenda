/**
 * Estados de reserva que NO ocupan el calendario de un recurso.
 *
 * DEBE coincidir, caracter por caracter, con el `WHERE` de la restriccion
 * `no_overlapping_resource_bookings` (`EXCLUDE USING gist`) que la
 * migracion de la Fase 2 agrega a mano sobre `booking_resources`:
 *
 *   WHERE (blocking = true AND status NOT IN ('cancelada', 'rechazada', 'expirada'))
 *
 * En la Fase 2 se agrega una prueba que LEE el SQL de esa migracion y
 * verifica que esta lista y aquel `WHERE` sigan diciendo lo mismo — para
 * que ese desfase no pueda volver en silencio. Es exactamente el origen
 * de una vulnerabilidad real de Espiral (2026-09-03): el pre-chequeo de
 * la app y la garantia del motor se desincronizaron y una cita
 * "rechazada" bloqueaba su horario para siempre desde un endpoint
 * anonimo. Ver PLAN_DESARROLLO.md §3 y §4.2.
 */
export const NON_BLOCKING_STATUSES = ['cancelada', 'rechazada', 'expirada'] as const;

export type NonBlockingStatus = (typeof NON_BLOCKING_STATUSES)[number];

const NON_BLOCKING_SET: ReadonlySet<string> = new Set(NON_BLOCKING_STATUSES);

/** `true` si una reserva en este estado SI ocupa el calendario. */
export function isBlockingStatus(status: string): boolean {
  return !NON_BLOCKING_SET.has(status);
}
