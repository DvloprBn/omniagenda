import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../jwt-payload.interface';

/**
 * Mitigacion de OWASP API5 (Broken Function Level Authorization). Guard
 * GLOBAL: corre despues de `JwtAuthGuard`. Devuelve `true` si la ruta no
 * declaro `@Roles(...)` (solo exige sesion) o si el rol del usuario esta
 * en la lista. Portado de OmniUser, con un `@Public()` de cortesia por si
 * alguien combina mal los decoradores.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const user: AuthenticatedUser = context.switchToHttp().getRequest().user;
    return requiredRoles.includes(user?.role);
  }
}
