import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
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
}
