import { IsIn, IsString, Length } from 'class-validator';
import { RESOURCE_KINDS, type ResourceKind } from '../../common/validation.util';

export class CreateResourceDto {
  @IsString()
  @Length(2, 150)
  name: string;

  @IsIn(RESOURCE_KINDS)
  kind: ResourceKind;
}
