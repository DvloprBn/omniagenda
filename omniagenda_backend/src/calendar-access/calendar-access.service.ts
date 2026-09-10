import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import {
  type CalendarRole,
  GLOBAL_MANAGER_ROLES,
  calendarRoleMeets,
} from './calendar-roles';

/**
 * La capa de permisos POR CALENDARIO — el aporte de OmniAgenda sobre el
 * RBAC global portado de OmniUser. El rol global sigue mandando en lo
 * SISTEMICO (crear usuarios, editar roles); esto decide quien puede tocar
 * QUE calendario.
 *
 * Regla base: un rol global admin/director/super es `manager` implicito en
 * TODOS los calendarios. Cualquier otra cuenta solo tiene lo que
 * `calendar_members` le otorgue explicitamente — mas, para lectura, lo que
 * la `visibility` del calendario permita.
 *
 * Este servicio se exporta para que los modulos de la Fase 4 (reservas,
 * horarios, disponibilidad) llamen `assertCalendarAccess` antes de tocar
 * nada de un calendario.
 */
@Injectable()
export class CalendarAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private isGlobalManager(globalRole: string): boolean {
    return (GLOBAL_MANAGER_ROLES as readonly string[]).includes(globalRole);
  }

  /**
   * El rol EFECTIVO de `user` sobre `calendarId`, o `null` si no tiene
   * ninguno (ni por membresia ni por rol global). No considera
   * `visibility` — eso lo resuelve `assertCalendarAccess` con
   * `allowByVisibility`.
   */
  async effectiveRole(user: AuthenticatedUser, calendarId: string): Promise<CalendarRole | null> {
    if (this.isGlobalManager(user.role)) return 'manager';
    const member = await this.prisma.calendar_members.findUnique({
      where: { calendar_id_user_id: { calendar_id: calendarId, user_id: user.userId } },
      select: { calendar_role: true },
    });
    return (member?.calendar_role as CalendarRole | undefined) ?? null;
  }

  /**
   * Lanza si `user` no alcanza `required` sobre `calendarId`.
   *
   * @param opts.allowByVisibility Si `true` y `required` es `viewer`, un
   *   calendario `public`/`busy_only` concede acceso de lectura aunque el
   *   usuario no sea miembro (la disponibilidad publica es una superficie
   *   deliberada — PLAN §4.1).
   * @throws {NotFoundException} si el calendario no existe.
   * @throws {ForbiddenException} si el usuario no alcanza el nivel requerido.
   */
  async assertCalendarAccess(
    user: AuthenticatedUser,
    calendarId: string,
    required: CalendarRole,
    opts: { allowByVisibility?: boolean } = {},
  ): Promise<void> {
    const calendar = await this.prisma.calendars.findUnique({
      where: { calendar_id: calendarId },
      select: { visibility: true },
    });
    if (!calendar) throw new NotFoundException('Calendario no encontrado');

    const held = await this.effectiveRole(user, calendarId);
    if (held && calendarRoleMeets(held, required)) return;

    if (
      opts.allowByVisibility &&
      required === 'viewer' &&
      (calendar.visibility === 'public' || calendar.visibility === 'busy_only')
    ) {
      return;
    }

    throw new ForbiddenException(`Necesitas permiso "${required}" sobre este calendario`);
  }

  /** Miembros explicitos de un calendario (no incluye a los admin/super globales, que son manager implicito). */
  async listMembers(caller: AuthenticatedUser, calendarId: string) {
    await this.assertCalendarAccess(caller, calendarId, 'viewer');
    return this.prisma.calendar_members.findMany({
      where: { calendar_id: calendarId },
      select: {
        calendar_member_id: true,
        calendar_role: true,
        granted_by: true,
        created_at: true,
        users: { select: { user_id: true, email: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Otorga (o actualiza) la membresia de `targetUserId`. Solo un `manager`
   * del calendario (o admin/super global) puede hacerlo.
   * @throws {NotFoundException} si el calendario o la cuenta objetivo no existen.
   */
  async grant(caller: AuthenticatedUser, calendarId: string, targetUserId: string, role: CalendarRole) {
    await this.assertCalendarAccess(caller, calendarId, 'manager');

    const target = await this.prisma.users.findUnique({ where: { user_id: targetUserId }, select: { user_id: true } });
    if (!target) throw new NotFoundException('La cuenta a la que quieres dar acceso no existe');

    return this.prisma.calendar_members.upsert({
      where: { calendar_id_user_id: { calendar_id: calendarId, user_id: targetUserId } },
      update: { calendar_role: role, granted_by: caller.userId },
      create: { calendar_id: calendarId, user_id: targetUserId, calendar_role: role, granted_by: caller.userId },
    });
  }

  /** Quita la membresia explicita. No afecta a un admin/super global (nunca tuvo fila). */
  async revoke(caller: AuthenticatedUser, calendarId: string, targetUserId: string): Promise<void> {
    await this.assertCalendarAccess(caller, calendarId, 'manager');
    await this.prisma.calendar_members.deleteMany({
      where: { calendar_id: calendarId, user_id: targetUserId },
    });
  }
}
