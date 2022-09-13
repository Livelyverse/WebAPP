import {
  IsString,
  Matches,
  IsOptional,
  IsNotEmpty,
  IsDefined,
  IsUUID
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SocialLivelyUpdateDto {
  public static from(dto: any): SocialLivelyUpdateDto | null {
    if (dto) {
      let livelyDto = new SocialLivelyUpdateDto();
      livelyDto.id = dto?.id;
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
  @IsString({ message: 'Username must be string' })
  @IsOptional()
  @ApiPropertyOptional()
  public username?: string;

  @IsNotEmpty({ message: 'UserId must not empty' })
  @IsString({ message: 'UserId must be string' })
  @IsOptional()
  @ApiPropertyOptional()
  userId?: string

  @IsNotEmpty({ message: 'ProfileName must not empty' })
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
