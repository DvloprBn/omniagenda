import { SetMetadata } from '@nestjs/common';
import type { CalendarRole as CalendarRoleName } from '../calendar-roles';

export const CALENDAR_ROLE_KEY = 'calendarRole';

export interface CalendarRoleOptions {
  /** Nombre del parametro de ruta que trae el id del calendario. Default `"calendarId"`. */
  param?: string;
  /** Si `true` y el nivel pedido es `viewer`, un calendario `public`/`busy_only` concede lectura sin membresia. */
  allowByVisibility?: boolean;
}

export interface CalendarRoleMeta extends Required<Pick<CalendarRoleOptions, 'param'>> {
  role: CalendarRoleName;
  allowByVisibility: boolean;
}

/**
 * Exige un nivel de permiso SOBRE EL CALENDARIO cuyo id viene en la ruta.
 * Lo evalua `CalendarAccessGuard`. Ejemplo:
 *   `@CalendarRole('manager') @Post(':calendarId/members')`
 */
export const CalendarRole = (role: CalendarRoleName, opts: CalendarRoleOptions = {}) =>
  SetMetadata<string, CalendarRoleMeta>(CALENDAR_ROLE_KEY, {
    role,
    param: opts.param ?? 'calendarId',
    allowByVisibility: opts.allowByVisibility ?? false,
  });
