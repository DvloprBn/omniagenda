import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CalendarsService } from './calendars.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

/**
 * `JwtAuthGuard` (global) exige sesión. La visibilidad fina de cada
 * calendario la resuelve `CalendarsService` vía `CalendarAccessService`.
 */
@Controller('calendars')
export class CalendarsController {
  constructor(private readonly calendars: CalendarsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.calendars.findAllForUser(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.calendars.findOne(user, id);
  }

  /** Crear un calendario: rol global staff+ (un `usuario` no crea calendarios). El creador queda como `manager`. */
  @Post()
  @HttpCode(201)
  @Roles('staff', 'manager', 'admin', 'director', 'super')
  create(@Body() dto: CreateCalendarDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendars.create(user, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCalendarDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendars.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.calendars.remove(user, id);
  }
}
