import {
  IsString,
  Matches,
  IsOptional,
  IsNotEmpty,
  IsDefined,
  IsEnum, IsNumberString, IsInt, IsUUID
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialActionType, UnitType } from "../entity/enums";

export class AirdropRuleUpdateDto {
  @IsNotEmpty({ message: 'Id must not empty' })
  @IsDefined({ message: 'Id must be defined' })
  @IsUUID("all", { message: 'Id must be valid UUID'})
  @ApiProperty()
  public id: string;

  @IsNotEmpty({ message: 'UnitType must not empty' })
  @IsDefined({ message: 'UnitType must be defined' })
  @IsEnum(UnitType, { message: `UnitType must one of these values, ${Object.values(UnitType).toString()}` } )
  @ApiProperty()
  unit: UnitType

  @IsNotEmpty({ message: 'Amount must not empty' })
  @IsDefined({ message: 'Amount must be defined' })
  @IsNumberString({ message: 'Amount must be number string' })
  @ApiProperty()
  amount: string;

  @IsNotEmpty({ message: 'Decimal must not empty' })
  @IsDefined({ message: 'Decimal must be defined' })
  @IsInt({ message: 'Decimal must be integer' })
  @ApiProperty()
  decimal: number
}
