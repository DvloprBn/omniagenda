import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'allowPendingPasswordChange';

/**
 * Marca una ruta como accesible aunque la cuenta tenga
 * `must_change_password: true` — reservado para lo minimo para completar
 * ese cambio (`GET /auth/me`, `PATCH /auth/me/password`). Cualquier otra
 * ruta autenticada queda bloqueada por `JwtAuthGuard`. Portado de OmniUser.
 */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
