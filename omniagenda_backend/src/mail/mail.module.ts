import { Global, Module } from '@nestjs/common';
import { Resend } from 'resend';
import { MailService } from './mail.service';
import { RESEND_CLIENT } from './mail.constants';

/**
 * `@Global()` — cualquier modulo manda correos sin reimportar esto. Falla
 * rapido al ARRANCAR si falta `RESEND_API_KEY` (mejor un error claro en el
 * arranque que un 500 silencioso a medio flujo de "olvide mi contrasena").
 * Portado de OmniUser.
 */
@Global()
@Module({
  providers: [
    {
      provide: RESEND_CLIENT,
      useFactory: () => {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          throw new Error('RESEND_API_KEY no esta definida — hace falta para poder mandar correos con Resend');
        }
        return new Resend(apiKey);
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
