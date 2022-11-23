import { IsDate, IsDefined, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { ApiProperty } from "@nestjs/swagger";

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

  @IsDate({ message: 'AirdropStartAt must not empty' })
  @IsOptional()
  @ApiProperty()
  airdropStartAt: Date

  @IsDate({ message: 'AirdropEndAt must not empty' })
  @IsDefined({ message: 'AirdropEndAt must be defined' })
  @IsOptional()
  @ApiProperty()
  airdropEndAt: Date

  hashTags: AirdropHashTagsUpdateDto
}

export class AirdropHashTagsUpdateDto {
  @IsNotEmpty({ message: 'AirdropTag must not empty' })
  @IsString({ message: 'AirdropTag must be string' })
  @IsOptional()
  @ApiProperty()
  airdropTag: string

  @IsNotEmpty({ message: 'JoinTag must not empty' })
  @IsString({ message: 'JoinTag must be string' })
  @IsOptional()
  @ApiProperty()
  joinTag: string
}