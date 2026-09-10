import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Sonda de salud de la Fase 0. Publica a proposito (no hay auth
   * todavia): es la forma en que `docker compose up` y el frontend
   * confirman en vivo que el proceso responde Y que llega de verdad a
   * Postgres y a Redis. Cuando exista el modelo fail-closed (Fase 3) esta
   * ruta se marca explicitamente @Public().
   */
  @Get('health')
  health() {
    return this.appService.health();
  }
}
