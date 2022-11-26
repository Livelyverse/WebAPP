import {
  IsDate,
  IsDefined,
  IsEnum,
  IsNotEmpty, IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from "class-validator";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";

export class AirdropHashtagsUpdateDto {
  @IsNotEmpty({ message: 'Airdrop must not empty' })
  @IsString({ message: 'Airdrop must be string' })
  @IsOptional()
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

export class AirdropScheduleUpdateDto {
  @IsNotEmpty({ message: 'Id must not empty' })
  @IsDefined({ message: 'Id must be defined' })
  @IsUUID("all", { message: 'Id must be valid UUID'})
  @ApiProperty()
  id: string;

  @IsNotEmpty({ message: 'SocialType must not empty' })
  @IsEnum(SocialType, { message: `SocialType must one of these values, ${Object.keys(SocialType).toString()}` })
  @IsOptional()
  @ApiProperty()
  socialType: SocialType

  @IsNotEmpty({ message: 'AirdropName must not empty' })
  @IsString({ message: 'AirdropName must be string' })
  @IsOptional()
  @ApiProperty()
  airdropName: string

  @IsNotEmpty({ message: 'Description must not empty' })
  @IsString({ message: 'Description must be string' })
  @IsOptional()
  @ApiProperty()
  description: string

  @IsDate({ message: 'AirdropStartAt must be valid date' })
  @Transform( ({ value }) => new Date(value))
  @IsOptional()
  @ApiProperty()
  airdropStartAt: Date


  @IsDate({ message: 'AirdropEndAt must be valid date' })
  @Transform( ({ value }) => new Date(value))
  @IsOptional()
  @ApiProperty()
  airdropEndAt: Date

  @IsNotEmptyObject()
  @ValidateNested({ each: true })
  @Type(() => AirdropHashtagsUpdateDto)
  @IsOptional()
  @ApiProperty()
  hashtags: AirdropHashtagsUpdateDto;
}