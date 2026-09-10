import { IsInt, IsOptional, IsPositive, IsString, Length, Min } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Length(2, 50)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;

  /** `RolesService.create` rechaza crear un rol de nivel igual/mayor al de quien lo crea. Default 0. */
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number;

  /** Tope de cuentas activas con este rol — omitir = sin limite. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  max_count?: number;
}
