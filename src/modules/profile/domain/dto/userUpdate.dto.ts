import {
  IsNotEmpty,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UserUpdateDto {
  @IsOptional()
  @ApiPropertyOptional()
  public walletAddress: string;

  @IsOptional()
  @ApiPropertyOptional()
  public fullName: string;
}
