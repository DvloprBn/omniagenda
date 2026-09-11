import { Type } from 'class-transformer';
import { IsObject, IsOptional, Matches, ValidateNested } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

class DayHoursDto {
  @Matches(HHMM, { message: 'open debe ser "HH:MM" 24h' })
  open: string;

  @Matches(HHMM, { message: 'close debe ser "HH:MM" 24h' })
  close: string;
}

/**
 * Horario semanal. Un día ausente o `null` = cerrado. Misma forma que
 * `artist_locations.weekly_hours` de Espiral. `@omniagenda/core` valida
 * además que `open < close` dentro del mismo día al expandirlo.
 */
class WeeklyHoursDto {
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) mon?: DayHoursDto | null;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) tue?: DayHoursDto | null;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) wed?: DayHoursDto | null;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) thu?: DayHoursDto | null;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) fri?: DayHoursDto | null;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) sat?: DayHoursDto | null;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) sun?: DayHoursDto | null;
}

export class UpsertScheduleRuleDto {
  @ValidateNested() @Type(() => WeeklyHoursDto)
  weekly_hours: WeeklyHoursDto;

  /** Opcional: la forma `RecurrenceRule` de `@omniagenda/core`, para patrones que el semanal no expresa. Passthrough por ahora (Fase 6 lo consume). */
  @IsOptional() @IsObject()
  recurrence?: Record<string, unknown>;
}
