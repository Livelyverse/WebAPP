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
  @IsUUID()
  @ApiProperty()
  public id: string;

  @IsEmail({ message: 'Email must be valid' })
  @ApiProperty()
  public email: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  public imageUrl: string;

  @IsOptional()
  @Matches(/^0x.*$/)
  @ApiPropertyOptional()
  public walletAddress: string;

  @IsNotEmpty()
  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  public firstname: string;

  @IsNotEmpty()
  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  public lastname: string;
}
