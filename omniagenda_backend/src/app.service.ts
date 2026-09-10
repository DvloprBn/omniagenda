import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

type CheckResult = 'ok' | `error: ${string}`;

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Toca de verdad las dos dependencias externas — un `SELECT 1` contra
   * Postgres y un `PING` contra Redis — y reporta cada una por separado.
   * A diferencia de un health "de proceso" (que solo confirma que Node
   * responde), este es el que prueba el objetivo real de la Fase 0: que
   * los 4 contenedores se hablan entre si.
   */
  async health() {
    const [postgres, redis] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`
        .then((): CheckResult => 'ok')
        .catch((e: unknown): CheckResult => `error: ${e instanceof Error ? e.message : String(e)}`),
      this.redis
        .ping()
        .then((r): CheckResult => (r === 'PONG' ? 'ok' : `error: respuesta inesperada "${r}"`))
        .catch((e: unknown): CheckResult => `error: ${e instanceof Error ? e.message : String(e)}`),
    ]);

    const ok = postgres === 'ok' && redis === 'ok';
    return {
      ok,
      service: 'omniagenda_backend',
      phase: 0,
      checks: { node: 'ok' as const, postgres, redis },
      time: new Date().toISOString(),
    };
  }
}
