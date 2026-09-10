import { IsEmail } from 'class-validator';

/** Paso 1 del login (UX estilo Google): solo el correo. Nunca revela si la cuenta existe. */
export class LoginStep1Dto {
  @IsEmail()
  email: string;
}
