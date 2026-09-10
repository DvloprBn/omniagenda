import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { escapeHtml } from '../common/utils/escape-html.util';

const LOGIN_THRESHOLD = 5;
const TWO_FACTOR_THRESHOLD = 5;
const WINDOW_SECONDS = 15 * 60;

interface RecordParams {
  /** Lo que se escribio en el campo real (correo en login, o el user_id ya autenticado en 2FA) — texto libre, NUNCA validado. */
  identifier: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Deteccion real de fuerza bruta — 3 puntos: login (contrasena), 2FA
 * (codigo TOTP) y reuso de refresh token robado. El conteo vive en Redis
 * (ventana deslizante); solo al cruzar el umbral se escribe una fila y se
 * manda UNA alerta por ventana. Portado de OmniUser.
 */
@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  /** Llamar SIEMPRE con el mismo `identifier` (el correo tal cual se escribio), exista o no la cuenta — si no, "no genera evento" seria un oraculo de enumeracion. */
  async recordFailedLogin(p: RecordParams): Promise<void> {
    try {
      const key = `security:login_fail:${p.identifier}`;
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, WINDOW_SECONDS);
      if (count < LOGIN_THRESHOLD) return;
      const windowBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
      await this.upsertAndMaybeAlert('login_bruteforce', p, count, windowBucket);
    } catch (e) {
      this.logger.error('Fallo al registrar un intento de login fallido', e as Error);
    }
  }

  async recordFailedTwoFactor(p: RecordParams): Promise<void> {
    try {
      const key = `security:2fa_fail:${p.identifier}`;
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, WINDOW_SECONDS);
      if (count < TWO_FACTOR_THRESHOLD) return;
      const windowBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
      await this.upsertAndMaybeAlert('twofactor_bruteforce', p, count, windowBucket);
    } catch (e) {
      this.logger.error('Fallo al registrar un intento fallido de 2FA', e as Error);
    }
  }

  /** Umbral 1 — un solo reuso de un refresh token ya revocado es senal fuerte por si sola. */
  async recordRefreshTokenReuse(p: RecordParams): Promise<void> {
    try {
      const windowBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
      await this.upsertAndMaybeAlert('refresh_token_reuse', p, 1, windowBucket);
    } catch (e) {
      this.logger.error('Fallo al registrar una reutilizacion de refresh token', e as Error);
    }
  }

  private async upsertAndMaybeAlert(type: string, p: RecordParams, attempts: number, windowBucket: number): Promise<void> {
    const fingerprint = createHash('sha256').update(`${type}|${p.identifier}|${windowBucket}`).digest('hex');

    const existing = await this.prisma.security_events.findUnique({ where: { fingerprint } });
    if (existing) {
      await this.prisma.security_events.update({
        where: { fingerprint },
        data: { attempts, occurrence_count: { increment: 1 }, last_seen_at: new Date() },
      });
      return;
    }

    await this.prisma.security_events.create({
      data: { fingerprint, type, identifier: p.identifier, ip_address: p.ip, user_agent: p.userAgent, attempts },
    });

    const alertKey = `security:alert_sent:${fingerprint}`;
    const sent = await this.redis.set(alertKey, '1', 'EX', WINDOW_SECONDS, 'NX');
    if (sent !== 'OK') return;

    const TYPE_LABEL: Record<string, string> = {
      login_bruteforce: 'Fuerza bruta en login',
      twofactor_bruteforce: 'Fuerza bruta en 2FA',
      refresh_token_reuse: 'Reutilizacion de refresh token',
    };
    // escapeHtml: p.identifier es SIEMPRE texto libre no validado (en
    // login_bruteforce es literalmente lo que se escribio en el campo
    // "correo" de un intento que fallo, nunca paso por @IsEmail()).
    const html = `<p><strong>${escapeHtml(p.identifier)}</strong> — ${attempts} intento(s), IP ${escapeHtml(p.ip ?? 'desconocida')}</p>`;
    await this.mail.notifyRoles(['admin', 'super'], `Alerta de seguridad: ${TYPE_LABEL[type] ?? type}`, html);
  }

  findAll(status?: string) {
    return this.prisma.security_events.findMany({
      where: status ? { status } : undefined,
      orderBy: { last_seen_at: 'desc' },
    });
  }
}
