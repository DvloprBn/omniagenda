import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Cliente real de Redis, envuelto como provider de NestJS (extiende la
 * clase `Redis` de `ioredis` — cualquier metodo de ioredis ya esta en
 * `this`, ej. `this.incr(...)`, `this.expire(...)`).
 *
 * El destino (host/puerto) se lee del entorno, no se incrusta como
 * constante: mismo principio que "la zona horaria es un dato, no una
 * constante" (PLAN_DESARROLLO.md §1) — un motor replicable no asume su
 * infraestructura. El fallback es el nombre del servicio en docker-compose.
 */
@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      host: process.env.REDIS_HOST ?? 'omniagenda_redis',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: false,
    });
  }

  /** Confirma la conexion real al arrancar (falla rapido y visible si Redis no responde). */
  async onModuleInit() {
    await this.ping();
  }

  /** Cierra la conexion de forma ordenada al apagar el proceso. */
  async onModuleDestroy() {
    await this.quit();
  }
}
