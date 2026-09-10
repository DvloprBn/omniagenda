import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Sonda de salud — `@Public()` (el `JwtAuthGuard` global la dejaria fuera
   * si no). Toca Postgres y Redis de verdad.
   */
  @Public()
  @Get('health')
  health() {
    return this.appService.health();
  }
}
