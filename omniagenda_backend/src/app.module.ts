import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { SecurityEventsModule } from './security-events/security-events.module';
import { CalendarAccessModule } from './calendar-access/calendar-access.module';
import { ResourcesModule } from './resources/resources.module';
import { CalendarsModule } from './calendars/calendars.module';
import { ScheduleRulesModule } from './schedule-rules/schedule-rules.module';
import { TimeOffModule } from './time-off/time-off.module';
import { BookingsModule } from './bookings/bookings.module';
import { AvailabilityModule } from './availability/availability.module';
import { MeModule } from './me/me.module';

/**
 * FASE 3 — auth portada de OmniUser + permisos por calendario, modelo
 * FAIL-CLOSED: `JwtAuthGuard` es global, asi que TODA ruta exige sesion
 * salvo las marcadas `@Public()`. `RolesGuard` global no opina si no hay
 * `@Roles(...)`. Orden real de los guards = orden de este arreglo:
 *   1. ThrottlerGuard  (rate limit, aun sin sesion)
 *   2. JwtAuthGuard    (exige token; puebla request.user; o salta si @Public)
 *   3. RolesGuard      (compara request.user.role contra @Roles)
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MailModule,
    // Limite global por IP, generoso: solo atrapa abuso grueso. Los
    // endpoints de alto riesgo (login/registro/2FA) tienen su propio
    // @Throttle() mas estricto. Guardado en Redis para sobrevivir un
    // restart del backend.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: seconds(60), limit: 60 }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    AuthModule,
    TwoFactorModule,
    RolesModule,
    UsersModule,
    SecurityEventsModule,
    CalendarAccessModule,
    // ── Fase 4 — API de agenda ──
    ResourcesModule,
    CalendarsModule,
    ScheduleRulesModule,
    TimeOffModule,
    BookingsModule,
    AvailabilityModule,
    // Vinculo opcional recurso<->cuenta (generaliza artists.user_id de Espiral).
    MeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
