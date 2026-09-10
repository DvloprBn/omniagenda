import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload, AuthenticatedUser } from '../jwt-payload.interface';

/** El access token viaja en una cookie httpOnly (nunca en `localStorage` — un XSS lo leeria), no en un header `Authorization`. */
function extractFromCookie(req: Request): string | null {
  return req?.cookies?.access_token ?? null;
}

/**
 * `passport-jwt` verifica FIRMA y EXPIRACION antes de llamar a `validate()`.
 * Este metodo hace lo que un JWT por si solo no puede: confirmar que la
 * cuenta SIGA existiendo y activa AHORA (no en el momento en que se firmo,
 * hasta 15 min atras). Portado de OmniUser.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET no esta definido en las variables de entorno');
    }
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: secret,
      // Algoritmo fijo explicito — mitiga el ataque de "confusion de
      // algoritmo" (forzar verificar un JWT HMAC con la llave publica RS256).
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.users.findUnique({
      where: { user_id: payload.sub },
      select: { is_active: true, must_change_password: true, roles: { select: { name: true, level: true } } },
    });
    if (!user || !user.is_active) {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.sub,
      role: user.roles.name,
      roleLevel: user.roles.level,
      mustChangePassword: user.must_change_password,
    };
  }
}
