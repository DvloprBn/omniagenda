/**
 * Permisos SOBRE UN CALENDARIO, encima del rol global. Ordenados de menor
 * a mayor: cada nivel incluye lo del anterior.
 *   viewer  — ve las reservas del calendario
 *   booker  — ademas crea/cancela SUS PROPIAS reservas
 *   manager — ademas gestiona todas las reservas, horarios, ausencias y la
 *             membresia del calendario
 */
export const CALENDAR_ROLES = ['viewer', 'booker', 'manager'] as const;
export type CalendarRole = (typeof CALENDAR_ROLES)[number];

export const CALENDAR_ROLE_RANK: Record<CalendarRole, number> = {
  viewer: 1,
  booker: 2,
  manager: 3,
};

/** Roles GLOBALES que son `manager` IMPLICITO en todos los calendarios (no necesitan fila en `calendar_members`). */
export const GLOBAL_MANAGER_ROLES = ['admin', 'director', 'super'] as const;

/** `true` si `held` alcanza el nivel `required`. */
export function calendarRoleMeets(held: CalendarRole, required: CalendarRole): boolean {
  return CALENDAR_ROLE_RANK[held] >= CALENDAR_ROLE_RANK[required];
}
