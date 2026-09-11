import { Global, Module } from '@nestjs/common';
import { CalendarAccessService } from './calendar-access.service';
import { CalendarAccessGuard } from './guards/calendar-access.guard';
import { CalendarMembersController } from './calendar-members.controller';

/**
 * Exporta `CalendarAccessService` (y el guard) para que los modulos de la
 * Fase 4 lo usen antes de tocar cualquier dato de un calendario.
 */
@Global()
@Module({
  providers: [CalendarAccessService, CalendarAccessGuard],
  controllers: [CalendarMembersController],
  exports: [CalendarAccessService, CalendarAccessGuard],
})
export class CalendarAccessModule {}
