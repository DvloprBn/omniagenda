/** `true` si `tz` es un nombre de zona horaria IANA que `Intl` reconoce. */
export function isValidIanaTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Estados de una reserva. Los 3 que NO ocupan el calendario viven en
 * `@omniagenda/core` (`NON_BLOCKING_STATUSES`) y en el `WHERE` del EXCLUDE;
 * esta lista es el conjunto completo, validado en los DTOs.
 */
export const BOOKING_STATUSES = [
  'pendiente',
  'confirmada',
  'cancelada',
  'rechazada',
  'expirada',
  'completada',
  'no_show',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const RESOURCE_KINDS = ['person', 'room', 'equipment', 'vehicle', 'other'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
