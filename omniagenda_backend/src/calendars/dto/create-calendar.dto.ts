import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateCalendarDto {
  @IsString() @Length(2, 150)
  name: string;

  /** Nombre IANA, ej. "America/Mexico_City". Se valida contra Intl en el servicio. */
  @IsString() @Length(1, 64)
  timezone: string;

  @IsOptional() @IsIn(['private', 'busy_only', 'public'])
  visibility?: 'private' | 'busy_only' | 'public';
}
