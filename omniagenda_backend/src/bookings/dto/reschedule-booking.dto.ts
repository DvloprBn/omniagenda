import { ArrayNotEmpty, ArrayUnique, IsDateString, IsInt, IsOptional, Min, IsUUID } from 'class-validator';

/** Mover una reserva: nuevo horario y/o nuevo conjunto de recursos. */
export class RescheduleBookingDto {
  @IsOptional() @IsDateString()
  starts_at?: string;

  @IsOptional() @IsDateString()
  ends_at?: string;

  @IsOptional() @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true })
  resource_ids?: string[];

  @IsOptional() @IsInt() @Min(0)
  buffer_minutes?: number;
}
