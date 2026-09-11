import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CalendarAccessGuard } from '../calendar-access/guards/calendar-access.guard';
import { CalendarRole } from '../calendar-access/decorators/calendar-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { BadRequestException } from '@nestjs/common';

/**
 * `/calendars/:calendarId/bookings`. `JwtAuthGuard` (global) exige sesión;
 * `CalendarAccessGuard` + `@CalendarRole(...)` exigen el nivel adecuado
 * SOBRE ESE calendario. `BookingsService` afina "propia vs. de otro".
 */
@Controller('calendars/:calendarId/bookings')
@UseGuards(CalendarAccessGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @CalendarRole('viewer', { allowByVisibility: true })
  list(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const fromD = new Date(from);
    const toD = new Date(to);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime()) || !(fromD < toD)) {
      throw new BadRequestException('Parámetros "from" y "to" (ISO 8601) obligatorios, con from < to');
    }
    return this.bookings.list(user, calendarId, { from: fromD, to: toD });
  }

  @Get(':bookingId')
  @CalendarRole('viewer', { allowByVisibility: true })
  findOne(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.findOne(user, calendarId, bookingId);
  }

  @Post()
  @HttpCode(201)
  @CalendarRole('booker')
  create(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.create(user, calendarId, dto);
  }

  @Patch(':bookingId')
  @CalendarRole('booker')
  reschedule(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.reschedule(user, calendarId, bookingId, dto);
  }

  @Patch(':bookingId/status')
  @CalendarRole('booker')
  changeStatus(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.changeStatus(user, calendarId, bookingId, dto.status);
  }

  @Delete(':bookingId')
  @HttpCode(204)
  @CalendarRole('manager')
  remove(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.remove(user, calendarId, bookingId);
  }
}
