import { IsIn } from 'class-validator';
import { CALENDAR_ROLES, type CalendarRole } from '../calendar-roles';

export class UpdateMembershipDto {
  @IsIn(CALENDAR_ROLES)
  calendar_role: CalendarRole;
}
