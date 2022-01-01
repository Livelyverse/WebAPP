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
import { UserCreateDto } from './userCreate.dto';

export class UserUpdateDto {
  @IsNotEmpty({ message: 'Username must not empty' })
  @IsDefined({ message: 'Username must be defined' })
  @IsString({ message: 'Username must be string' })
  @ApiProperty()
  public username: string;

  @IsEmail({ message: 'Email must be valid' })
  @IsNotEmpty({ message: 'Email must not empty' })
  @IsDefined({ message: 'Email must be defined' })
  @IsString({ message: 'Email must be string' })
  @ApiProperty()
  public email: string;

  @Length(4, 128, { message: 'Group length at least 4 characters' })
  @IsNotEmpty({ message: 'Group must not empty' })
  @IsDefined({ message: 'Group must be defined' })
  @IsString({ message: 'Group must be string' })
  @ApiProperty()
  public group: string;

  @IsOptional()
  @ApiPropertyOptional()
  public imageUrl: string;

  @IsOptional()
  // @Matches(/^0x.*$/)
  @ApiPropertyOptional()
  public walletAddress: string;

  @IsOptional()
  @ApiPropertyOptional()
  public firstname?: string;

  @IsOptional()
  @ApiPropertyOptional()
  public lastname?: string;
}
