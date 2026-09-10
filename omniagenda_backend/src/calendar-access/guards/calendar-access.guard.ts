import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CalendarAccessService } from '../calendar-access.service';
import { CALENDAR_ROLE_KEY, type CalendarRoleMeta } from '../decorators/calendar-role.decorator';
import type { AuthenticatedUser } from '../../auth/jwt-payload.interface';

/**
 * Corre DESPUES de `JwtAuthGuard` (que ya poblo `request.user`). Lee el
 * `@CalendarRole(...)` de la ruta, saca el id del calendario del parametro
 * indicado, y delega en `CalendarAccessService.assertCalendarAccess`
 * (lanza 403/404 si no cumple). Se aplica por ruta con `@UseGuards`, no
 * global — necesita un parametro de ruta.
 */
@Injectable()
export class CalendarAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly calendarAccess: CalendarAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<CalendarRoleMeta>(CALENDAR_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true; // sin @CalendarRole, este guard no opina

    const req = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = req.user;
    const calendarId: string | undefined = req.params?.[meta.param];
    if (!calendarId) {
      throw new BadRequestException(`Falta el parametro de ruta "${meta.param}"`);
    }

    await this.calendarAccess.assertCalendarAccess(user, calendarId, meta.role, {
      allowByVisibility: meta.allowByVisibility,
    });
    return true;
  }
}
