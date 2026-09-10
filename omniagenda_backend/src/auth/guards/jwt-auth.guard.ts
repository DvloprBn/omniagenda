import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';
import type { AuthenticatedUser } from '../jwt-payload.interface';

/**
 * Guard GLOBAL (ver AppModule) — modelo *fail-closed*: exige un access
 * token valido en TODA ruta salvo las marcadas `@Public()`. Ademas bloquea
 * del lado del SERVIDOR cualquier cuenta con `must_change_password: true`
 * en rutas que no lleven `@AllowPendingPasswordChange()` — confiar en que
 * el frontend redirija no basta contra un cliente HTTP directo.
 *
 * Difiere de OmniUser (donde este guard era per-controller): aqui `Public`
 * es lo explicito, no `UseGuards`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: AuthenticatedUser | false, info: unknown, context: ExecutionContext): TUser {
    const authenticated = super.handleRequest(err, user, info, context) as AuthenticatedUser;

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authenticated.mustChangePassword && !allowPending) {
      throw new ForbiddenException('Debes cambiar tu contrasena temporal antes de continuar');
    }
    return authenticated as unknown as TUser;
  }
}
