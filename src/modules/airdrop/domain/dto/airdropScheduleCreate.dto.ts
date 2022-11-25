import {
  IsDate,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";

export class AirdropHashtagsCreateDto {
  @IsNotEmpty({ message: 'Airdrop must not empty' })
  @IsDefined({ message: 'Airdrop must be defined' })
  @IsString({ message: 'Airdrop must be string' })
  @ApiProperty()
  airdrop: string

  @IsNotEmpty({ message: 'Join must not empty' })
  @IsString({ message: 'Join must be string' })
  @IsOptional()
  @ApiProperty()
  join: string

  @IsNotEmpty({ message: 'Comment must not empty' })
  @IsString({ message: 'Comment must be string' })
  @IsOptional()
  @ApiProperty()
  comment: string
}

export class AirdropScheduleCreateDto {
  @IsNotEmpty({ message: 'SocialType must not empty' })
  @IsDefined({ message: 'SocialType must be defined' })
  @IsEnum(SocialType, { message: `SocialType must one of these values, ${Object.keys(SocialType).toString()}` })
  @ApiProperty()
  socialType: SocialType

  @IsNotEmpty({ message: 'AirdropName must not empty' })
  @IsDefined({ message: 'AirdropName must be defined' })
  @IsString({ message: 'AirdropName must be string' })
  @ApiProperty()
  airdropName: string

  @IsNotEmpty({ message: 'Description must not empty' })
  @IsDefined({ message: 'Description must be defined' })
  @IsString({ message: 'Description must be string' })
  @IsOptional()
  @ApiProperty()
  description: string

  @IsDate({ message: 'AirdropStartAt must be valid date' })
  @Transform( ({ value }) => new Date(value))
  @IsDefined({ message: 'AirdropStartAt must be defined' })
  @ApiProperty()
  airdropStartAt: Date

  @IsDate({ message: 'AirdropEndAt must be valid date' })
  @Transform( ({ value }) => new Date(value))
  @IsDefined({ message: 'AirdropEndAt must be defined' })
  @ApiProperty()
  airdropEndAt: Date

  @IsDefined({ message: 'Hashtags must be defined' })
  @IsNotEmptyObject()
  @ValidateNested({ each: true })
  @Type(() => AirdropHashtagsCreateDto)
  @ApiProperty()
  hashtags: AirdropHashtagsCreateDto;
}

