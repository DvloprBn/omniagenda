import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../jwt-payload.interface';

/** `@CurrentUser()` en vez de leer `request.user` a mano — `JwtStrategy.validate()` es quien lo llena. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  return ctx.switchToHttp().getRequest().user;
});
