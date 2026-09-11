import { IsIn } from 'class-validator';
import { BOOKING_STATUSES, type BookingStatus } from '../../common/validation.util';

export class ChangeStatusDto {
  @IsIn(BOOKING_STATUSES)
  status: BookingStatus;
}
