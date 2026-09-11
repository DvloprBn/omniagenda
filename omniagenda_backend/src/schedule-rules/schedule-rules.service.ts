import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarAccessService } from '../calendar-access/calendar-access.service';
import { UpsertScheduleRuleDto } from './dto/upsert-schedule-rule.dto';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import type { Prisma } from '../../generated/prisma/client';

/** Horario semanal de un (recurso, calendario). Uno por par (`@@unique`). Gestión = `manager` del calendario. */
@Injectable()
export class ScheduleRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CalendarAccessService,
  ) {}

  async list(caller: AuthenticatedUser, calendarId: string) {
    await this.access.assertCalendarAccess(caller, calendarId, 'viewer', { allowByVisibility: true });
    return this.prisma.schedule_rules.findMany({
      where: { calendar_id: calendarId },
      select: {
        schedule_rule_id: true, resource_id: true, weekly_hours: true, recurrence: true, active: true,
        resources: { select: { name: true, kind: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async upsert(caller: AuthenticatedUser, calendarId: string, resourceId: string, dto: UpsertScheduleRuleDto) {
    await this.access.assertCalendarAccess(caller, calendarId, 'manager');
    const resource = await this.prisma.resources.findUnique({ where: { resource_id: resourceId }, select: { resource_id: true } });
    if (!resource) throw new NotFoundException('Recurso no encontrado');

    const data = {
      weekly_hours: dto.weekly_hours as unknown as Prisma.InputJsonValue,
      recurrence: (dto.recurrence ?? undefined) as Prisma.InputJsonValue | undefined,
    };
    return this.prisma.schedule_rules.upsert({
      where: { resource_id_calendar_id: { resource_id: resourceId, calendar_id: calendarId } },
      update: data,
      create: { resource_id: resourceId, calendar_id: calendarId, ...data },
    });
  }

  async remove(caller: AuthenticatedUser, calendarId: string, resourceId: string): Promise<void> {
    await this.access.assertCalendarAccess(caller, calendarId, 'manager');
    await this.prisma.schedule_rules.deleteMany({ where: { calendar_id: calendarId, resource_id: resourceId } });
  }
}
