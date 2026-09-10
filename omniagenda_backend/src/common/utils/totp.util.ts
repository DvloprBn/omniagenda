import { authenticator } from 'otplib';

/**
 * Funciones puras de TOTP (RFC 6238) — sin dependencias de NestJS/Prisma,
 * para que `AuthService` y `TwoFactorService` las usen sin crear una
 * dependencia circular. `otplib` implementa el algoritmo del RFC; aqui
 * solo se envuelve con nombres del dominio. Portado de OmniUser.
 */

/** Secreto nuevo (base32) — usado UNA vez al iniciar el setup de una cuenta. */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** URI `otpauth://...` que una app de 2FA escanea como QR. */
export function totpKeyUri(secret: string, accountLabel: string, issuer = 'OmniAgenda'): string {
  return authenticator.keyuri(accountLabel, issuer, secret);
}

/** Verifica un codigo de 6 digitos contra el secreto — tolera el desfase de reloj tipico (+-1 paso de 30 s). */
export function verifyTotp(secret: string, code: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
