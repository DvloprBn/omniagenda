import { IsString } from 'class-validator';

/** Reusado por `disable` y `recovery-codes/regenerate` — ambas debilitan 2FA, ambas re-exigen la contrasena actual. */
export class CurrentPasswordDto {
  @IsString()
  currentPassword: string;
}
