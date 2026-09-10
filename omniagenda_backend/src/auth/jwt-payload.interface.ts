/**
 * Forma del payload DENTRO del JWT de acceso — firmado, NUNCA cifrado:
 * cualquiera lo decodifica (es Base64); la llave solo impide falsificarlo.
 * Nunca va aqui nada verdaderamente secreto. Portado de OmniUser.
 */
export interface JwtPayload {
  /** `users.user_id` */
  sub: string;
  /** Nombre del rol global (ej. `"admin"`) — evita una consulta a BD solo para saber el rol en cada request. */
  role: string;
}

/**
 * Lo que queda en `request.user` tras pasar `JwtAuthGuard`.
 * `role`/`roleLevel`/`mustChangePassword` se leen EN VIVO de Postgres en
 * cada request (ver `JwtStrategy.validate`) — un rol degradado o una
 * cuenta desactivada surten efecto de inmediato, no hasta que expire el
 * access token.
 */
export interface AuthenticatedUser {
  userId: string;
  role: string;
  /** `roles.level` real, leido en vivo — lo usa `UsersService.assertCanManageRole` y `CalendarAccessService`. */
  roleLevel: number;
  mustChangePassword: boolean;
}

/**
 * Payload del "challenge token" de corta vida entre el paso 2 (contrasena
 * correcta) y el paso 3 (codigo 2FA) del login — NUNCA es un token de
 * sesion; un `JwtAuthGuard` normal lo rechazaria por no tener `role`.
 */
export interface TwoFactorChallengePayload {
  sub: string;
  /** Marca literal que distingue este token de un access token real. */
  purpose: 'two_factor_challenge';
}
