import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateTimeOffDto {
  @IsUUID()
  resource_id: string;

  /** "YYYY-MM-DD". Rango inclusivo en ambos extremos (como `artist_time_off` de Espiral). */
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional() @IsString() @Length(1, 200)
  reason?: string;

  /**
   * `true`  → la ausencia aplica SOLO a este calendario (`calendar_id` = éste).
   * `false` (default) → aplica al recurso en TODOS sus calendarios (`calendar_id` = null).
   */
  @IsOptional() @IsBoolean()
  calendar_scoped?: boolean;
}
