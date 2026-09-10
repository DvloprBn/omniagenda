import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta como accesible SIN autenticacion. Nuevo respecto a
 * OmniUser: aqui `JwtAuthGuard` es global (modelo *fail-closed*, ver
 * AppModule y el CHECKLIST de seguridad) — TODA ruta exige sesion salvo
 * las que lleven este decorador explicito. Un endpoint que olvide marcarse
 * queda protegido por defecto, no expuesto.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
