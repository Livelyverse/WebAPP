import {
  IsEmail,
  IsNotEmpty,
  IsDefined,
  IsString,
  Length,
  Matches,
  IsDate,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserUpdateDto {
  @IsUUID()
  @ApiProperty()
  public id: string;

  @IsNotEmpty({ message: 'Username must not empty' })
  @IsDefined({ message: 'Username must be defined' })
  @IsString({ message: 'Username must be string' })
  @ApiPropertyOptional()
  public username?: string;

  @IsEmail({ message: 'Email must be valid' })
  @IsNotEmpty({ message: 'Email must not empty' })
  @IsDefined({ message: 'Email must be defined' })
  @IsString({ message: 'Email must be string' })
  @ApiPropertyOptional()
  public email?: string;

  @IsOptional()
  @ApiPropertyOptional()
  public imageUrl?: string;

  @IsOptional()
  // @Matches(/^0x.*$/)
  @ApiPropertyOptional()
  public walletAddress?: string;

  @IsOptional()
  @ApiPropertyOptional()
  public firstname?: string;

  @IsOptional()
  @ApiPropertyOptional()
  public lastname?: string;
}