import { IsEmail, IsString } from 'class-validator';

/** Paso 2: correo + contrasena. Sin 2FA activo, este paso ya emite la sesion. */
export class LoginStep2Dto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
