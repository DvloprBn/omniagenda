import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { RESOURCE_KINDS, type ResourceKind } from '../../common/validation.util';

export class UpdateResourceDto {
  @IsOptional() @IsString() @Length(2, 150)
  name?: string;

  @IsOptional() @IsIn(RESOURCE_KINDS)
  kind?: ResourceKind;

  @IsOptional() @IsBoolean()
  active?: boolean;
}
