import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Resend } from 'resend';
import { RESEND_CLIENT } from './mail.constants';
import { PrismaService } from '../prisma/prisma.service';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envio real de correo (Resend) — integracion real desde el primer commit,
 * nunca simulada. Sin dominio propio verificado, usa el remitente de
 * pruebas de Resend (`onboarding@resend.dev`), que SI manda correos reales
 * pero solo a la cuenta duena de la API key. Portado de OmniUser.
 *
 * Cuenta de Resend COMPARTIDA del portafolio (PLAN_DESARROLLO.md §0.2):
 * solo claves de prueba, nunca produccion.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress = process.env.MAIL_FROM_ADDRESS ?? 'onboarding@resend.dev';

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Nunca relanza — un correo que falla no debe tumbar un flujo que ya
   * paso (ej. la cuenta ya se creo). El caller decide que hacer con el `false`.
   */
  async send({ to, subject, html }: SendMailInput): Promise<boolean> {
    try {
      const { error } = await this.resend.emails.send({ from: this.fromAddress, to, subject, html });
      if (error) {
        this.logger.error(`Resend rechazo el correo a ${to} ("${subject}"): ${JSON.stringify(error)}`);
        return false;
      }
      this.logger.log(`Correo enviado a ${to}: "${subject}"`);
      return true;
    } catch (e) {
      this.logger.error(`Error de red/API enviando correo a ${to} ("${subject}")`, e as Error);
      return false;
    }
  }

  /** El mismo correo a TODAS las cuentas activas con alguno de los roles dados — usado por `SecurityEventsService` para avisar a admin/super. */
  async notifyRoles(roles: string[], subject: string, html: string): Promise<void> {
    const recipients = await this.prisma.users.findMany({
      where: { roles: { name: { in: roles } }, is_active: true },
      select: { email: true },
    });
    for (const r of recipients) {
      await this.send({ to: r.email, subject, html });
    }
  }
}
