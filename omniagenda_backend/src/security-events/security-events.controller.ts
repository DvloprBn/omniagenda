import { Controller, Get, Query } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';
import { Roles } from '../auth/decorators/roles.decorator';

/** Solo admin/super — `JwtAuthGuard` + `RolesGuard` son globales (ver AppModule), aqui basta declarar el rol. */
@Controller('security-events')
@Roles('admin', 'super')
export class SecurityEventsController {
  constructor(private readonly securityEvents: SecurityEventsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.securityEvents.findAll(status);
  }
}
