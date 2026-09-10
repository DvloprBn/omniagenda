import { IsInt, IsOptional, IsPositive, IsString, Length, Min } from 'class-validator';

/** El `name`/`level`/`max_count` de un rol `is_system` no se pueden cambiar (ver `RolesService.update`). */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  max_count?: number;
}
