import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ButtonStyle } from 'discord.js';

enum EDiscordButtonStyle {
  Primary,
  Secondary,
  Success,
  Danger,
  Link,
}

class DiscordMessageButtonDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  label: string;

  @IsOptional()
  @IsEnum(ButtonStyle)
  @ApiPropertyOptional({
    description: `this property can be
      1 = primary
      2 = secondary
      3 = success
      4 = danger
      5 = link
    `
  })
  color: ButtonStyle;
}

export class DiscordAirdropMessageDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'hex code color' })
  color: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordAirdropMessageDto)
  button: DiscordMessageButtonDto[];
}