import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/** `@Global()`, mismo criterio que `PrismaModule`. */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
