import {
  IsNotEmpty,
  IsDefined,
  IsEnum, IsNumberString, IsInt
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialActionType, UnitType } from "../entity/enums";

export class AirdropRuleCreateDto {
  @IsNotEmpty({ message: 'SocialType must not empty' })
  @IsDefined({ message: 'SocialType must be defined' })
  @IsEnum(SocialType, { message: `SocialType must one of these values, ${Object.keys(SocialType).toString()}` } )
  @ApiProperty()
  socialType: SocialType

  @IsNotEmpty({ message: 'SocialActionType must not empty' })
  @IsDefined({ message: 'SocialActionType must be defined' })
  @IsEnum(SocialActionType, { message: `SocialActionType must one of these values, ${Object.keys(SocialActionType).toString()}` } )
  @ApiProperty()
  actionType: SocialActionType

  @IsNotEmpty({ message: 'UnitType must not empty' })
  @IsDefined({ message: 'UnitType must be defined' })
  @IsEnum(UnitType, { message: `UnitType must one of these values, ${Object.keys(UnitType).toString()}` } )
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
