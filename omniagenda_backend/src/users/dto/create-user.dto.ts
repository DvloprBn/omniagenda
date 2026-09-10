import { IsEmail, IsInt, IsOptional, IsString, Length } from 'class-validator';

/** Alta administrativa — un admin/super crea cuentas con CUALQUIER rol permitido por la jerarquia. */
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @IsInt()
  role_id: number;
}
