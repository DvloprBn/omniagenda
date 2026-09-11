import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ScheduleRulesService } from './schedule-rules.service';
import { UpsertScheduleRuleDto } from './dto/upsert-schedule-rule.dto';
import { CalendarAccessGuard } from '../calendar-access/guards/calendar-access.guard';
import { CalendarRole } from '../calendar-access/decorators/calendar-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

@Controller('calendars/:calendarId/schedule-rules')
@UseGuards(CalendarAccessGuard)
export class ScheduleRulesController {
  constructor(private readonly rules: ScheduleRulesService) {}

  @Get()
  @CalendarRole('viewer', { allowByVisibility: true })
  list(@Param('calendarId', ParseUUIDPipe) calendarId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rules.list(user, calendarId);
  }

  @Put(':resourceId')
  @CalendarRole('manager')
  upsert(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() dto: UpsertScheduleRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rules.upsert(user, calendarId, resourceId, dto);
  }

  @Delete(':resourceId')
  @HttpCode(204)
  @CalendarRole('manager')
  remove(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rules.remove(user, calendarId, resourceId);
  }
}
