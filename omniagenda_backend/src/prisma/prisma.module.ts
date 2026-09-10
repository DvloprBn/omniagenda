import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * `@Global()`: una vez importado en `AppModule`, cualquier modulo puede
 * inyectar `PrismaService` sin volver a listar `PrismaModule` en su propio
 * `imports` — evita repetir el import en cada feature que hable a la base.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
