import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarAccessService } from '../calendar-access/calendar-access.service';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

/**
 * Ausencias por rango de días. Una ausencia "de calendario" (`calendar_id`
 * fijo) solo afecta a ese calendario; una "de recurso" (`calendar_id` null)
 * afecta al recurso en todos. Gestión = `manager` del calendario.
 */
@Injectable()
export class TimeOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CalendarAccessService,
  ) {}

  /** Ids de recursos con un horario en este calendario — para saber qué ausencias "de recurso" mostrar aquí. */
  private async resourceIdsInCalendar(calendarId: string): Promise<string[]> {
    const rules = await this.prisma.schedule_rules.findMany({ where: { calendar_id: calendarId }, select: { resource_id: true } });
    return rules.map((r) => r.resource_id);
  }

  async list(caller: AuthenticatedUser, calendarId: string) {
    await this.access.assertCalendarAccess(caller, calendarId, 'viewer', { allowByVisibility: true });
    const resourceIds = await this.resourceIdsInCalendar(calendarId);
    return this.prisma.time_off.findMany({
      where: {
        OR: [
          { calendar_id: calendarId },
          { calendar_id: null, resource_id: { in: resourceIds } },
        ],
      },
      orderBy: { start_date: 'asc' },
    });
  }

  async create(caller: AuthenticatedUser, calendarId: string, dto: CreateTimeOffDto) {
    await this.access.assertCalendarAccess(caller, calendarId, 'manager');
    const resource = await this.prisma.resources.findUnique({ where: { resource_id: dto.resource_id }, select: { resource_id: true } });
    if (!resource) throw new NotFoundException('Recurso no encontrado');

    try {
      return await this.prisma.time_off.create({
        data: {
          resource_id: dto.resource_id,
          calendar_id: dto.calendar_scoped ? calendarId : null,
          start_date: new Date(dto.start_date),
          end_date: new Date(dto.end_date),
          reason: dto.reason,
          created_by: caller.userId,
        },
      });
    } catch (e) {
      // CHECK (start_date <= end_date) a mano en la migración.
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2010' || String(e.message).includes('time_off_date_range_valid'))) {
        throw new BadRequestException('La fecha de inicio no puede ser posterior a la de fin');
      }
      throw e;
    }
  }

  async remove(caller: AuthenticatedUser, calendarId: string, timeOffId: string): Promise<void> {
    await this.access.assertCalendarAccess(caller, calendarId, 'manager');
    const row = await this.prisma.time_off.findUnique({ where: { time_off_id: timeOffId } });
    if (!row) throw new NotFoundException('Ausencia no encontrada');
    // Solo se puede borrar desde un calendario que la "ve": la suya, o una
    // de recurso cuyo recurso tiene horario aquí.
    const resourceIds = await this.resourceIdsInCalendar(calendarId);
    const visibleHere = row.calendar_id === calendarId || (row.calendar_id === null && resourceIds.includes(row.resource_id));
    if (!visibleHere) throw new NotFoundException('Ausencia no encontrada');
    await this.prisma.time_off.delete({ where: { time_off_id: timeOffId } });
  }
}
