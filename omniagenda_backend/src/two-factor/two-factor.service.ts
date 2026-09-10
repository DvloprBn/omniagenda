import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { generateTotpSecret, totpKeyUri, verifyTotp } from '../common/utils/totp.util';
import { encryptTotpSecret, decryptTotpSecret } from '../common/utils/crypto.util';

/** 10 codigos de recuperacion por generacion — el numero real que usan Google/GitHub. */
const RECOVERY_CODES_COUNT = 10;

/**
 * Setup, confirmacion y administracion de 2FA (TOTP, RFC 6238). Todo aqui
 * requiere una sesion YA autenticada (JwtAuthGuard global) — nunca se
 * activa/desactiva 2FA de una cuenta ajena. Portado de OmniUser sin cambios.
 */
@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un secreto nuevo, lo guarda cifrado (con `totp_enabled` aun
   * false), y regresa el QR (data URI PNG) + el secreto en texto para
   * captura manual.
   * @throws {BadRequestException} si la cuenta ya tiene 2FA activo.
   */
  async setup(userId: string, accountEmail: string): Promise<{ qrCodeDataUrl: string; secret: string }> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { user_id: userId } });
    if (user.totp_enabled) {
      throw new BadRequestException('Esta cuenta ya tiene 2FA activo — desactivalo antes de configurar uno nuevo.');
    }

    const secret = generateTotpSecret();
    await this.prisma.users.update({ where: { user_id: userId }, data: { totp_secret_encrypted: encryptTotpSecret(secret) } });

    const uri = totpKeyUri(secret, accountEmail);
    const qrCodeDataUrl = await QRCode.toDataURL(uri);
    return { qrCodeDataUrl, secret };
  }

  /**
   * Valida que el codigo del usuario coincida con el secreto pendiente;
   * solo entonces activa `totp_enabled` y genera los 10 codigos de
   * recuperacion (se muestran UNA vez).
   * @throws {BadRequestException} si no hay setup pendiente, o el codigo no coincide.
   */
  async confirmSetup(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { user_id: userId } });
    if (!user.totp_secret_encrypted) {
      throw new BadRequestException('No hay un setup de 2FA pendiente — llama a /two-factor/setup primero.');
    }

    const secret = decryptTotpSecret(user.totp_secret_encrypted);
    if (!verifyTotp(secret, code)) {
      throw new BadRequestException('El codigo no coincide — revisa la hora de tu telefono e intentalo de nuevo.');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { user_id: userId }, data: { totp_enabled: true } }),
      this.prisma.totp_recovery_codes.deleteMany({ where: { user_id: userId } }),
      this.prisma.totp_recovery_codes.createMany({ data: await this.hashRecoveryCodes(userId, recoveryCodes) }),
    ]);

    return { recoveryCodes };
  }

  /**
   * Desactiva 2FA — exige la contrasena actual (una sesion secuestrada, sin
   * la contrasena, no puede quitar el segundo factor en silencio).
   * @throws {UnauthorizedException} si `currentPassword` no coincide.
   */
  async disable(userId: string, currentPassword: string): Promise<void> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { user_id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new UnauthorizedException('La contrasena actual no es correcta');
    }

    await this.prisma.$transaction([
      this.prisma.users.update({ where: { user_id: userId }, data: { totp_enabled: false, totp_secret_encrypted: null } }),
      this.prisma.totp_recovery_codes.deleteMany({ where: { user_id: userId } }),
    ]);
  }

  /**
   * Invalida TODOS los codigos de recuperacion y genera 10 nuevos. Misma
   * exigencia de contrasena que `disable`.
   * @throws {UnauthorizedException} si `currentPassword` no coincide, o si la cuenta no tiene 2FA activo.
   */
  async regenerateRecoveryCodes(userId: string, currentPassword: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { user_id: userId } });
    if (!user.totp_enabled) {
      throw new UnauthorizedException('Esta cuenta no tiene 2FA activo');
    }
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new UnauthorizedException('La contrasena actual no es correcta');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.totp_recovery_codes.deleteMany({ where: { user_id: userId } }),
      this.prisma.totp_recovery_codes.createMany({ data: await this.hashRecoveryCodes(userId, recoveryCodes) }),
    ]);
    return { recoveryCodes };
  }

  /** Formato `XXXX-XXXX` (8 hex mayus con guion) — legible, ~32 bits, ya limitado por intentos. */
  private generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODES_COUNT }, () => {
      const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    });
  }

  private async hashRecoveryCodes(userId: string, codes: string[]) {
    return Promise.all(codes.map(async (code) => ({ user_id: userId, code_hash: await bcrypt.hash(code, 12) })));
  }
}
