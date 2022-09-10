import {
  IsString,
  Matches,
  IsOptional,
  IsNotEmpty,
  IsDefined,
  IsEnum, IsUUID
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";

export class SocialLivelyUpdateDto {
  public static from(dto: any): SocialLivelyUpdateDto | null {
    if (dto) {
      let livelyDto = new SocialLivelyUpdateDto();
      livelyDto.id = dto?.id;
      livelyDto.socialType = dto?.socialType;
      livelyDto.userId = dto?.userId;
      livelyDto.username = dto?.username;
      livelyDto.profileName = dto?.profileName;
      livelyDto.profileUrl = dto?.profileUrl;
      return livelyDto;
    }
    return null;
  }

  @IsNotEmpty({ message: 'Id must not empty' })
  @IsDefined({ message: 'Id must be defined' })
  @IsUUID("all", { message: 'Id must be valid UUID'})
  @ApiProperty()
  public id: string;

  @IsNotEmpty({ message: 'Username must not empty' })
  @IsDefined({ message: 'Username must be defined' })
  @IsString({ message: 'Username must be string' })
  @IsOptional()
  @ApiPropertyOptional()
  public username?: string;

  @IsNotEmpty({ message: 'SocialType must not empty' })
  @IsDefined({ message: 'SocialType must be defined' })
  @IsEnum(SocialType, { message: 'SocialType must one of these values, TWITTER | INSTAGRAM | TIKTOK | TELEGRAM | DISCORD' } )
  @IsOptional()
  @ApiPropertyOptional()
  socialType?: SocialType

  @IsString({ message: 'Username must be string' })
  @IsOptional()
  @ApiPropertyOptional()
  userId?: string

  @IsString({ message: 'ProfileName must be string' })
  @IsOptional()
  @ApiPropertyOptional()
  profileName?: string

  @Matches(/(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/,
    { message: 'ProfileUrl must be valid url'})
  @IsOptional()
  @ApiPropertyOptional()
  profileUrl?: string
}
