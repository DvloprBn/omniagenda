import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeAvailability,
  instantFromWall,
  NON_BLOCKING_STATUSES,
  type Interval,
  type WeeklyHours,
} from '@omniagenda/core';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarAccessService } from '../calendar-access/calendar-access.service';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

export interface AvailabilityQueryInput {
  resourceId: string;
  from: Date;
  to: Date;
  bufferMinutes?: number;
  minSlotMinutes?: number;
}

/**
 * Disponibilidad de un recurso en un calendario = (horario semanal −
 * ausencias − (reservas que ocupan + colchón)) → filtrar huecos cortos.
 * Todo el cálculo lo hace `@omniagenda/core` (`computeAvailability`); aquí
 * solo se cargan los datos y se les da forma.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CalendarAccessService,
  ) {}

  async compute(caller: AuthenticatedUser, calendarId: string, q: AvailabilityQueryInput): Promise<Interval[]> {
    await this.access.assertCalendarAccess(caller, calendarId, 'viewer', { allowByVisibility: true });

    const calendar = await this.prisma.calendars.findUnique({ where: { calendar_id: calendarId }, select: { timezone: true } });
    if (!calendar) throw new NotFoundException('Calendario no encontrado');
    if (!(q.from.getTime() < q.to.getTime())) throw new BadRequestException('"from" debe ser anterior a "to"');

    const rule = await this.prisma.schedule_rules.findUnique({
      where: { resource_id_calendar_id: { resource_id: q.resourceId, calendar_id: calendarId } },
      select: { weekly_hours: true },
    });
    if (!rule) return []; // el recurso no tiene horario en este calendario

    const window: Interval = { start: q.from.getTime(), end: q.to.getTime() };

    // Ausencias: rango de días → intervalos [00:00 del start_date, 24:00 del end_date] en la zona del calendario.
    const timeOffRows = await this.prisma.time_off.findMany({
      where: {
        resource_id: q.resourceId,
        OR: [{ calendar_id: calendarId }, { calendar_id: null }],
        start_date: { lte: q.to },
        end_date: { gte: q.from },
      },
      select: { start_date: true, end_date: true },
    });
    const timeOff: Interval[] = timeOffRows.map((t) => {
      const s = t.start_date;
      const e = t.end_date;
      return {
        start: instantFromWall({ year: s.getUTCFullYear(), month: s.getUTCMonth() + 1, day: s.getUTCDate(), hour: 0, minute: 0 }, calendar.timezone),
        // fin inclusivo → hasta el inicio del día SIGUIENTE al end_date
        end: instantFromWall({ year: e.getUTCFullYear(), month: e.getUTCMonth() + 1, day: e.getUTCDate() + 1, hour: 0, minute: 0 }, calendar.timezone),
      };
    });

    // Reservas que ocupan (estado bloqueante).
    const busyRows = await this.prisma.booking_resources.findMany({
      where: {
        resource_id: q.resourceId,
        status: { notIn: [...NON_BLOCKING_STATUSES] },
        blocking: true,
        start_time: { lt: q.to },
        end_time: { gt: q.from },
      },
      select: { start_time: true, end_time: true },
    });
    const busy: Interval[] = busyRows.map((b) => ({ start: b.start_time.getTime(), end: b.end_time.getTime() }));

    return computeAvailability({
      window,
      timeZone: calendar.timezone,
      weeklyHours: rule.weekly_hours as unknown as WeeklyHours,
      timeOff,
      busy,
      bufferMinutes: q.bufferMinutes,
      minSlotMinutes: q.minSlotMinutes,
    });
  }
}
