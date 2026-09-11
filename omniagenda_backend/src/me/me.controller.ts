import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { MeService } from './me.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

/**
 * Rutas personales — ninguna necesita `@Roles`/`@CalendarRole`: cualquier
 * cuenta autenticada puede preguntar por SU PROPIA agenda; si no
 * representa ningún recurso, `MeService` responde 404 con un mensaje
 * claro, nunca una lista vacía disfrazada de "no tienes nada".
 */
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('schedule')
  schedule(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const fromD = new Date(from);
    const toD = new Date(to);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime()) || !(fromD < toD)) {
      throw new BadRequestException('Parámetros "from" y "to" (ISO 8601) obligatorios, con from < to');
    }
    return this.me.schedule(user.userId, fromD, toD);
  }
}
