import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CalendarAccessService } from './calendar-access.service';
import { CalendarAccessGuard } from './guards/calendar-access.guard';
import { CalendarRole } from './decorators/calendar-role.decorator';
import { GrantMembershipDto } from './dto/grant-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

/**
 * Membresia de un calendario: `/calendars/:calendarId/members`.
 * `JwtAuthGuard` (global) exige sesion; `CalendarAccessGuard` +
 * `@CalendarRole(...)` exigen el nivel adecuado SOBRE ESE calendario
 * (o rol global admin/director/super).
 */
@Controller('calendars/:calendarId/members')
@UseGuards(CalendarAccessGuard)
export class CalendarMembersController {
  constructor(private readonly calendarAccess: CalendarAccessService) {}

  @Get()
  @CalendarRole('viewer')
  list(@Param('calendarId', ParseUUIDPipe) calendarId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.calendarAccess.listMembers(user, calendarId);
  }

  @Post()
  @HttpCode(201)
  @CalendarRole('manager')
  grant(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Body() dto: GrantMembershipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarAccess.grant(user, calendarId, dto.user_id, dto.calendar_role);
  }

  @Patch(':userId')
  @CalendarRole('manager')
  update(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMembershipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarAccess.grant(user, calendarId, userId, dto.calendar_role);
  }

  @Delete(':userId')
  @HttpCode(204)
  @CalendarRole('manager')
  revoke(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarAccess.revoke(user, calendarId, userId);
  }
}
