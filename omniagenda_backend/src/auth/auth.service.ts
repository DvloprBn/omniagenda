import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import ms from 'ms';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/templates/password-reset.template';
import { SecurityEventsService } from '../security-events/security-events.service';
import { verifyTotp } from '../common/utils/totp.util';
import { decryptTotpSecret } from '../common/utils/crypto.util';
import type { JwtPayload, TwoFactorChallengePayload } from './jwt-payload.interface';

/**
 * Nucleo de autenticacion PORTADO de OmniUser (`dvlopmnt/login`) con toda
 * su profundidad: registro publico, login en 3 pasos (correo → contrasena →
 * 2FA si aplica), refresh/logout con rotacion + ventana de gracia +
 * revocacion en cascada ante reuso, cambio y recuperacion de contrasena.
 * Ninguna logica cambia respecto al original — solo nombres.
 */

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInMs: number;
  refreshTokenExpiresInMs: number;
}

/** Rol que recibe cualquier cuenta de registro publico — nunca admin/super. */
const DEFAULT_SELF_REGISTER_ROLE = 'usuario';
/** Margen de gracia en la rotacion: 2 pestanas renovando casi a la vez no deben tronar con 401. */
const REFRESH_TOKEN_GRACE_MS = 30_000;
const PASSWORD_RESET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  /** Mensaje IDENTICO para "no existe" y "contrasena incorrecta" (OWASP API2: no ser un oraculo de enumeracion). */
  private readonly invalidCredentialsMessage = 'Credenciales invalidas';

  /** @throws {ConflictException} si el correo ya tiene cuenta. */
  async register(
    email: string,
    password: string,
    name: string | undefined,
    meta: RequestMeta,
  ): Promise<{ tokens: TokenPair; user: { id: string; email: string; role: string } }> {
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ese correo ya esta registrado');
    }

    const role = await this.prisma.roles.findUniqueOrThrow({ where: { name: DEFAULT_SELF_REGISTER_ROLE } });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.users.create({
      data: { email, password_hash: passwordHash, name, role_id: role.role_id },
    });

    const tokens = await this.issueTokenPair(user.user_id, role.name, meta);
    return { tokens, user: { id: user.user_id, email: user.email, role: role.name } };
  }

  /** Paso 1 — solo existe para que el frontend avance de la pantalla de correo a la de contrasena. Nunca revela si la cuenta existe. */
  async loginStep1(_email: string): Promise<{ ok: true }> {
    return { ok: true };
  }

  /**
   * Paso 2: valida correo+contrasena. Sin 2FA activo, este paso ya emite la
   * sesion completa. Con 2FA activo, emite un `challenge token` corto en su
   * lugar.
   * @throws {UnauthorizedException} credenciales invalidas o cuenta inactiva — mismo mensaje.
   */
  async loginStep2(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<
    | { requiresTwoFactor: false; tokens: TokenPair; user: { id: string; email: string; role: string } }
    | { requiresTwoFactor: true; challengeToken: string; challengeTokenExpiresInMs: number }
  > {
    const user = await this.prisma.users.findUnique({ where: { email }, include: { roles: true } });

    if (!user || !user.is_active) {
      void this.securityEvents.recordFailedLogin({ identifier: email, ip: meta.ipAddress, userAgent: meta.userAgent });
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      void this.securityEvents.recordFailedLogin({ identifier: email, ip: meta.ipAddress, userAgent: meta.userAgent });
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    if (!user.totp_enabled) {
      const tokens = await this.issueTokenPair(user.user_id, user.roles.name, meta);
      return { requiresTwoFactor: false, tokens, user: { id: user.user_id, email: user.email, role: user.roles.name } };
    }

    const challengePayload: TwoFactorChallengePayload = { sub: user.user_id, purpose: 'two_factor_challenge' };
    const challengeToken = await this.jwtService.signAsync(challengePayload, { expiresIn: TWO_FACTOR_CHALLENGE_TTL_MS / 1000 });
    return { requiresTwoFactor: true, challengeToken, challengeTokenExpiresInMs: TWO_FACTOR_CHALLENGE_TTL_MS };
  }

  /**
   * Paso 3 (solo si el paso 2 pidio 2FA): challenge token (cookie aparte) +
   * codigo de 6 digitos TOTP o uno de recuperacion. Se prueba primero como
   * TOTP, luego como recuperacion.
   * @throws {UnauthorizedException} challenge invalido/expirado, cuenta sin 2FA, o codigo incorrecto.
   */
  async loginStep3(rawChallengeToken: string | undefined, code: string, meta: RequestMeta): Promise<{ tokens: TokenPair; user: { id: string; email: string; role: string } }> {
    if (!rawChallengeToken) {
      throw new UnauthorizedException();
    }

    let payload: TwoFactorChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<TwoFactorChallengePayload>(rawChallengeToken);
    } catch {
      throw new UnauthorizedException('El paso de contrasena expiro — vuelve a iniciar sesion.');
    }
    if (payload.purpose !== 'two_factor_challenge') {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.users.findUnique({ where: { user_id: payload.sub }, include: { roles: true } });
    if (!user || !user.is_active || !user.totp_enabled || !user.totp_secret_encrypted) {
      throw new UnauthorizedException();
    }

    const isValidTotp = verifyTotp(decryptTotpSecret(user.totp_secret_encrypted), code);
    const isValidRecoveryCode = isValidTotp ? false : await this.tryConsumeRecoveryCode(user.user_id, code);

    if (!isValidTotp && !isValidRecoveryCode) {
      void this.securityEvents.recordFailedTwoFactor({ identifier: user.user_id, ip: meta.ipAddress, userAgent: meta.userAgent });
      throw new UnauthorizedException('Codigo invalido');
    }

    const tokens = await this.issueTokenPair(user.user_id, user.roles.name, meta);
    return { tokens, user: { id: user.user_id, email: user.email, role: user.roles.name } };
  }

  /** Prueba `code` contra los codigos de recuperacion sin usar; marca el primero que haga match como usado (un solo uso real). */
  private async tryConsumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const unused = await this.prisma.totp_recovery_codes.findMany({ where: { user_id: userId, used_at: null } });
    for (const candidate of unused) {
      if (await bcrypt.compare(code, candidate.code_hash)) {
        await this.prisma.totp_recovery_codes.update({ where: { code_id: candidate.code_id }, data: { used_at: new Date() } });
        return true;
      }
    }
    return false;
  }

  /**
   * Rota un refresh token. Ventana de gracia: si el token que llega ya
   * estaba revocado pero fue hace menos de `REFRESH_TOKEN_GRACE_MS`, es una
   * carrera entre pestanas — se deja pasar. Si paso mas tiempo, es un robo
   * real: se revocan TODAS las sesiones de la cuenta.
   * @throws {UnauthorizedException} token ausente/no encontrado/expirado, o reuso fuera de la gracia.
   */
  async refresh(rawRefreshToken: string | undefined, meta: RequestMeta): Promise<TokenPair> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException();
    }
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const existing = await this.prisma.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
      include: { users: { include: { roles: true } } },
    });

    if (!existing || existing.expires_at < new Date()) {
      throw new UnauthorizedException();
    }

    if (existing.revoked) {
      const withinGrace = existing.used_at && Date.now() - existing.used_at.getTime() <= REFRESH_TOKEN_GRACE_MS;
      if (!withinGrace) {
        await this.prisma.refresh_tokens.updateMany({
          where: { user_id: existing.user_id, revoked: false },
          data: { revoked: true },
        });
        void this.securityEvents.recordRefreshTokenReuse({ identifier: existing.users.email, ip: meta.ipAddress, userAgent: meta.userAgent });
        throw new UnauthorizedException();
      }
      return this.issueTokenPair(existing.users.user_id, existing.users.roles.name, meta);
    }

    await this.prisma.refresh_tokens.update({
      where: { token_id: existing.token_id },
      data: { revoked: true, used_at: new Date() },
    });

    return this.issueTokenPair(existing.users.user_id, existing.users.roles.name, meta);
  }

  /** Revoca el refresh token de esta sesion — no lanza si ya no existe. */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.refresh_tokens.updateMany({
      where: { token_hash: tokenHash, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * Cambia la contrasena de una cuenta YA autenticada — revoca TODOS sus
   * refresh tokens al terminar.
   * @throws {UnauthorizedException} si `currentPassword` no coincide.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.users.findUnique({ where: { user_id: userId } });
    if (!user) throw new UnauthorizedException();

    const currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentMatches) {
      throw new UnauthorizedException('La contrasena actual no es correcta');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { user_id: userId }, data: { password_hash: newPasswordHash, must_change_password: false } }),
      this.prisma.refresh_tokens.updateMany({ where: { user_id: userId, revoked: false }, data: { revoked: true } }),
    ]);
  }

  /** "Olvide mi contrasena" — nunca revela si el correo existe. Nunca lanza ni regresa nada distinto segun el caso. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user || !user.is_active) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      this.prisma.password_reset_tokens.deleteMany({ where: { user_id: user.user_id, used_at: null } }),
      this.prisma.password_reset_tokens.create({
        data: { user_id: user.user_id, token_hash: this.hashResetToken(rawToken), expires_at: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS) },
      }),
    ]);

    const resetUrl = `${process.env.FRONTEND_URL}/restablecer-password?token=${rawToken}`;
    const { subject, html } = passwordResetEmail({ name: user.name, resetUrl });
    await this.mail.send({ to: user.email, subject, html });
  }

  /**
   * Consume el token del link de reset — un solo uso. Revoca todos los
   * refresh tokens igual que `changePassword`.
   * @throws {BadRequestException} token no encontrado, ya usado, o expirado.
   */
  async resetPasswordWithToken(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashResetToken(rawToken);
    const record = await this.prisma.password_reset_tokens.findUnique({ where: { token_hash: tokenHash } });
    if (!record || record.used_at || record.expires_at < new Date()) {
      throw new BadRequestException('Este link ya no es valido — pide que te reenvien el correo.');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { user_id: record.user_id }, data: { password_hash: newPasswordHash, must_change_password: false } }),
      this.prisma.password_reset_tokens.update({ where: { token_id: record.token_id }, data: { used_at: new Date() } }),
      this.prisma.refresh_tokens.updateMany({ where: { user_id: record.user_id, revoked: false }, data: { revoked: true } }),
    ]);
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Perfil de la cuenta autenticada — usado por `GET /auth/me`. */
  async getProfile(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { user_id: userId },
      include: { roles: { select: { name: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Esta cuenta ya no existe');
    }
    return {
      userId: user.user_id,
      role: user.roles.name,
      name: user.name,
      email: user.email,
      must_change_password: user.must_change_password,
      totp_enabled: user.totp_enabled,
    };
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** El unico punto donde una sesion completa nace: access JWT + refresh opaco (solo su hash se persiste). */
  private async issueTokenPair(userId: string, role: string, meta: RequestMeta): Promise<TokenPair> {
    const accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
    const refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

    const payload: JwtPayload = { sub: userId, role };
    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: accessTokenExpiresIn as ms.StringValue });

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiresInMs = ms(refreshTokenExpiresIn as ms.StringValue);

    await this.prisma.refresh_tokens.create({
      data: {
        user_id: userId,
        token_hash: this.hashRefreshToken(rawRefreshToken),
        expires_at: new Date(Date.now() + refreshTokenExpiresInMs),
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      accessTokenExpiresInMs: ms(accessTokenExpiresIn as ms.StringValue),
      refreshTokenExpiresInMs,
    };
  }
}
