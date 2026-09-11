import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { CalendarAccessGuard } from '../calendar-access/guards/calendar-access.guard';
import { CalendarRole } from '../calendar-access/decorators/calendar-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

@Controller('calendars/:calendarId/availability')
@UseGuards(CalendarAccessGuard)
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /**
   * GET .../availability?resource_id=&from=&to=&buffer_minutes=&min_slot_minutes=
   * Devuelve los huecos LIBRES como intervalos `{ start, end }` en ms epoch.
   * Nunca revela las reservas ocupadas en sí — solo el espacio libre
   * (la disponibilidad es un dato personal, PLAN §4.1).
   */
  @Get()
  @CalendarRole('viewer', { allowByVisibility: true })
  compute(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Query('resource_id', ParseUUIDPipe) resourceId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('buffer_minutes') bufferMinutes: string | undefined,
    @Query('min_slot_minutes') minSlotMinutes: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const fromD = new Date(from);
    const toD = new Date(to);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
      throw new BadRequestException('"from" y "to" (ISO 8601) son obligatorios');
    }
    return this.availability.compute(user, calendarId, {
      resourceId,
      from: fromD,
      to: toD,
      bufferMinutes: bufferMinutes ? Number(bufferMinutes) : undefined,
      minSlotMinutes: minSlotMinutes ? Number(minSlotMinutes) : undefined,
    });
  }
}
