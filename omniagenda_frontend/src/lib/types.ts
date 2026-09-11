/**
 * Formas reales que devuelve la API del backend (Fase 3/4). Escritas a
 * mano a partir del contrato real de los DTOs/servicios — no generadas,
 * asi que si el backend cambia una forma, esto hay que actualizarlo aqui
 * tambien (no hay un unico punto de verdad compartido entre frontend y
 * backend en Fase 5; una libreria de tipos compartidos es candidato para
 * cuando OmniAgenda tenga un segundo consumidor real).
 */

export interface AuthUser {
  userId: string;
  role: string;
  name: string | null;
  email: string;
  must_change_password: boolean;
  totp_enabled: boolean;
}

export type CalendarVisibility = 'private' | 'busy_only' | 'public';

export interface Calendar {
  calendar_id: string;
  name: string;
  timezone: string;
  visibility: CalendarVisibility;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ResourceKind = 'person' | 'room' | 'equipment' | 'vehicle' | 'other';

export interface Resource {
  resource_id: string;
  name: string;
  kind: ResourceKind;
  active: boolean;
  calendar_switch_buffer_minutes: number;
  created_at: string;
  updated_at: string;
}

export type BookingStatus = 'pendiente' | 'confirmada' | 'cancelada' | 'rechazada' | 'expirada' | 'completada' | 'no_show';

/** Forma completa (vista 'full' — el llamador es miembro real o el calendario es público). */
export interface Booking {
  booking_id: string;
  calendar_id: string;
  title: string | null;
  status: BookingStatus;
  source_type: string | null;
  source_id: string | null;
  created_by: string | null;
  starts_at: string;
  ends_at: string;
  resource_ids: string[];
  blocking: boolean;
}

/** Forma recortada (vista 'busy_only' — sin membresía real en un calendario que no es 'public'). */
export type BusyBooking = Pick<Booking, 'booking_id' | 'starts_at' | 'ends_at' | 'status' | 'resource_ids' | 'blocking'>;

/** El rango libre que devuelve GET /calendars/:id/availability — ms epoch. */
export interface FreeInterval {
  start: number;
  end: number;
}
