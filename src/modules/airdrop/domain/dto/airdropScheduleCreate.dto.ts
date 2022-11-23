import { IsDate, IsDefined, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { ApiProperty } from "@nestjs/swagger";

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

  @IsDate({ message: 'AirdropStartAt must not empty' })
  @IsDefined({ message: 'AirdropStartAt must be defined' })
  @ApiProperty()
  airdropStartAt: Date

  @IsDate({ message: 'AirdropEndAt must not empty' })
  @IsDefined({ message: 'AirdropEndAt must be defined' })
  @ApiProperty()
  airdropEndAt: Date

  hashTags: AirdropHashTagsCreateDto
}

export class AirdropHashTagsCreateDto {
  @IsNotEmpty({ message: 'AirdropTag must not empty' })
  @IsDefined({ message: 'AirdropTag must be defined' })
  @IsString({ message: 'AirdropTag must be string' })
  @ApiProperty()
  airdropTag: string

  @IsNotEmpty({ message: 'JoinTag must not empty' })
  @IsString({ message: 'JoinTag must be string' })
  @IsOptional()
  @ApiProperty()
  joinTag: string
}