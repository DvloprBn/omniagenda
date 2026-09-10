import { IsString, Length } from 'class-validator';

/** Paso 3 (solo con 2FA activo) — el challenge token viaja en cookie corta aparte, no en este body. */
export class LoginTwoFactorDto {
  /** Codigo de 6 digitos TOTP, o uno de los 10 codigos de recuperacion (mas largo). `AuthService` prueba ambos. */
  @IsString()
  @Length(6, 20)
  code: string;
}
