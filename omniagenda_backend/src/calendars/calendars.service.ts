import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarAccessService } from '../calendar-access/calendar-access.service';
import { GLOBAL_MANAGER_ROLES } from '../calendar-access/calendar-roles';
import { isValidIanaTimeZone } from '../common/validation.util';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

@Injectable()
export class CalendarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CalendarAccessService,
  ) {}

  /**
   * Crea un calendario y, en la MISMA transacción, hace a quien lo creó
   * `manager` de él — sin esto, el creador no podría ni verlo (fail-closed).
   */
  async create(caller: AuthenticatedUser, dto: CreateCalendarDto) {
    if (!isValidIanaTimeZone(dto.timezone)) {
      throw new BadRequestException(`"${dto.timezone}" no es una zona horaria IANA válida`);
    }
    return this.prisma.$transaction(async (tx) => {
      const cal = await tx.calendars.create({
        data: { name: dto.name, timezone: dto.timezone, visibility: dto.visibility ?? 'private' },
      });
      await tx.calendar_members.create({
        data: { calendar_id: cal.calendar_id, user_id: caller.userId, calendar_role: 'manager', granted_by: caller.userId },
      });
      return cal;
    });
  }

  /** Los calendarios que `caller` puede ver: todos si es admin+ global; si no, en los que es miembro + los `public`. */
  async findAllForUser(caller: AuthenticatedUser) {
    if ((GLOBAL_MANAGER_ROLES as readonly string[]).includes(caller.role)) {
      return this.prisma.calendars.findMany({ orderBy: { created_at: 'desc' } });
    }
    return this.prisma.calendars.findMany({
      where: {
        OR: [
          { visibility: 'public' },
          { calendar_members: { some: { user_id: caller.userId } } },
        ],
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(caller: AuthenticatedUser, id: string) {
    await this.access.assertCalendarAccess(caller, id, 'viewer', { allowByVisibility: true });
    return this.prisma.calendars.findUniqueOrThrow({ where: { calendar_id: id } });
  }

  async update(caller: AuthenticatedUser, id: string, dto: UpdateCalendarDto) {
    await this.access.assertCalendarAccess(caller, id, 'manager');
    if (dto.timezone !== undefined && !isValidIanaTimeZone(dto.timezone)) {
      throw new BadRequestException(`"${dto.timezone}" no es una zona horaria IANA válida`);
    }
    return this.prisma.calendars.update({ where: { calendar_id: id }, data: dto });
  }

  /** Borrado duro. La FK `bookings.calendar_id` es `Restrict` — un calendario con reservas no se puede borrar (usa `active:false`). */
  async remove(caller: AuthenticatedUser, id: string): Promise<void> {
    await this.access.assertCalendarAccess(caller, id, 'manager');
    try {
      await this.prisma.calendars.delete({ where: { calendar_id: id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException('Este calendario tiene reservas — desactívalo (active:false) en vez de borrarlo');
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Calendario no encontrado');
      }
      throw e;
    }
  }
}
