import { IsIn, IsUUID } from 'class-validator';
import { CALENDAR_ROLES, type CalendarRole } from '../calendar-roles';

export class GrantMembershipDto {
  @IsUUID()
  user_id: string;

  @IsIn(CALENDAR_ROLES)
  calendar_role: CalendarRole;
}
