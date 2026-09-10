import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/**
 * FASE 0: solo lo minimo para arrancar y probar que los 4 servicios se
 * hablan entre si — Prisma (Postgres) y Redis, mas un endpoint /health que
 * los toca de verdad.
 *
 * Lo que se suma despues, en su fase:
 *   - ThrottlerModule global (rate limiting en Redis)  -> Fase 3
 *   - APP_GUARD de autenticacion (modelo fail-closed)  -> Fase 3
 *   - @nestjs/schedule para los cron de expiracion     -> Fase 6
 * Ver PLAN_DESARROLLO.md §8.
 */
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
