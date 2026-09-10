import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// Prisma 7 (generator "prisma-client"): el cliente vive en generated/prisma,
// no en @prisma/client. El punto de entrada real es "client.ts".
import { PrismaClient } from '../../generated/prisma/client';
// Prisma 7 exige un "driver adapter" explicito. Para Postgres, este habla
// el protocolo directo via la libreria "pg".
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Envoltura de PrismaClient como provider de NestJS. No expone metodos
 * propios: hereda todo lo que Prisma genera (`this.$queryRaw`,
 * `this.$transaction(...)`, y a partir de la Fase 2 `this.bookings`, etc.).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  /** Abre la conexion real a Postgres al arrancar el modulo. */
  async onModuleInit() {
    await this.$connect();
  }

  /** Cierra la conexion de forma ordenada al apagar el proceso. */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
