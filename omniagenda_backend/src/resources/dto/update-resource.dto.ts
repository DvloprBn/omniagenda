import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, IsString, Length, Min } from 'class-validator';
import { RESOURCE_KINDS, type ResourceKind } from '../../common/validation.util';

export class UpdateResourceDto {
  @IsOptional() @IsString() @Length(2, 150)
  name?: string;

  @IsOptional() @IsIn(RESOURCE_KINDS)
  kind?: ResourceKind;

  @IsOptional() @IsBoolean()
  active?: boolean;

  /**
   * Colchón (minutos) contra otra reserva de este recurso en OTRO
   * calendario — el "colchón de traslado" entre sucursales. `0` = el
   * recurso no viaja entre calendarios, o no importa si lo hace.
   */
  @IsOptional() @IsInt() @Min(0)
  calendar_switch_buffer_minutes?: number;

  /**
   * Vincula (o desvincula, mandando `null`) este recurso con una cuenta
   * real — generaliza `artists.user_id` de Espiral. `@IsOptional()` en
   * class-validator ya trata `null` como "sin validar más" (no hace
   * falta un `@ValidateIf` aparte): un id real SÍ se valida como UUID,
   * `null` pasa directo para desvincular. Quien lo administra ya está
   * gateado por el controller (rol global manager+, igual que el resto
   * de este DTO).
   */
  @IsOptional()
  @IsUUID('4')
  user_id?: string | null;
}
