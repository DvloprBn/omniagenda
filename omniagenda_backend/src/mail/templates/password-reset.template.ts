import { escapeHtml } from '../../common/utils/escape-html.util';

/** Correo de "olvide mi contrasena" — link de un solo uso, 2 h de vigencia. Portado de OmniUser. */
export function passwordResetEmail(params: { name: string | null; resetUrl: string }): { subject: string; html: string } {
  const name = params.name ? escapeHtml(params.name) : null;
  return {
    subject: 'Restablecer tu contrasena — OmniAgenda',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
        <h1 style="font-size:20px;">Restablecer tu contrasena</h1>
        <p>Hola${name ? `, ${name}` : ''} — pediste restablecer tu contrasena.</p>
        <p><a href="${params.resetUrl}" style="display:inline-block;margin:12px 0;padding:10px 20px;background:#6d28d9;color:#fff;border-radius:6px;text-decoration:none;">Elegir nueva contrasena</a></p>
        <p style="font-size:13px;color:#6b7280;">Este link es valido por 2 horas y solo funciona una vez. Si no pediste este cambio, ignora este correo.</p>
      </div>
    `,
  };
}
