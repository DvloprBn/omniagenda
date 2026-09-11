import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCalendarDto {
  @IsOptional() @IsString() @Length(2, 150)
  name?: string;

  @IsOptional() @IsString() @Length(1, 64)
  timezone?: string;

  @IsOptional() @IsIn(['private', 'busy_only', 'public'])
  visibility?: 'private' | 'busy_only' | 'public';

  @IsOptional() @IsBoolean()
  active?: boolean;
}
