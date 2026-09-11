import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TimeOffService } from './time-off.service';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { CalendarAccessGuard } from '../calendar-access/guards/calendar-access.guard';
import { CalendarRole } from '../calendar-access/decorators/calendar-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

@Controller('calendars/:calendarId/time-off')
@UseGuards(CalendarAccessGuard)
export class TimeOffController {
  constructor(private readonly timeOff: TimeOffService) {}

  @Get()
  @CalendarRole('viewer', { allowByVisibility: true })
  list(@Param('calendarId', ParseUUIDPipe) calendarId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.list(user, calendarId);
  }

  @Post()
  @HttpCode(201)
  @CalendarRole('manager')
  create(@Param('calendarId', ParseUUIDPipe) calendarId: string, @Body() dto: CreateTimeOffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.create(user, calendarId, dto);
  }

  @Delete(':timeOffId')
  @HttpCode(204)
  @CalendarRole('manager')
  remove(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('timeOffId', ParseUUIDPipe) timeOffId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeOff.remove(user, calendarId, timeOffId);
  }
}
