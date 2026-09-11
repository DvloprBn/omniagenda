import { ArrayNotEmpty, ArrayUnique, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Min, IsUUID } from 'class-validator';
import { BOOKING_STATUSES, type BookingStatus } from '../../common/validation.util';

export class CreateBookingDto {
  @IsOptional() @IsString() @Length(1, 500)
  title?: string;

  /** Instante ISO 8601 (con zona), ej. "2026-06-15T10:00:00-06:00". */
  @IsDateString()
  starts_at: string;

  @IsDateString()
  ends_at: string;

  /** Uno o más recursos que la reserva ocupa a la vez (multi-recurso). */
  @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true })
  resource_ids: string[];

  /** Estado inicial. Default 'pendiente'. */
  @IsOptional() @IsIn(BOOKING_STATUSES)
  status?: BookingStatus;

  /** `false` = bloque no-bloqueante (una tarea, un apartado tentativo): se ve pero no rechaza a otro. Default true. */
  @IsOptional() @IsBoolean()
  blocking?: boolean;

  /** Colchón en minutos que debe separar esta reserva de otra del mismo recurso (el "colchón de traslado" de Espiral). */
  @IsOptional() @IsInt() @Min(0)
  buffer_minutes?: number;

  /** Puente al negocio anfitrión — OmniAgenda no los interpreta. */
  @IsOptional() @IsString() @Length(1, 40)
  source_type?: string;

  @IsOptional() @IsString() @Length(1, 64)
  source_id?: string;
}
