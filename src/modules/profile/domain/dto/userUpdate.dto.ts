import {
  IsString,
  IsOptional, Length
} from "class-validator";
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UserUpdateDto {
  @IsOptional()
  @IsString({ message: 'walletAddress must be string' })
  @ApiPropertyOptional()
  public walletAddress: string;

  @IsOptional()
  @Length(4, 128, { message: 'full length between 4 and 128 characters' })
  @IsString({ message: 'fullName must be string' })
  @ApiPropertyOptional()
  public fullName: string;
}
