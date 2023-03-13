import {
  IsString, IsEmail, Matches, IsBoolean,
  IsOptional, Length, IsDefined
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

  @IsOptional()
  @IsDefined({ message: 'Email must be defined' })
  @IsEmail({ message: 'Email must be valid' })
  @ApiPropertyOptional()
  public email: string;

  @IsOptional()
  @Length(8, 128, { message: 'Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])|(?=.*[A-Z])|(?=.*\d)\S+$/, {
    message: 'Password must contains lowercase, uppercase and digits',
  })
  @Matches(/^(?=.*[a-z])|(?=.*[A-Z])\S+$/, {
    message: 'Password must contains lowercase and uppercase',
  })
  @Matches(/^(?=.*[a-z])|(?=.*\d)\S+$/, {
    message: 'Password must contains lowercase and digits',
  })
  @Matches(/^(?=.*[A-Z])|(?=.*\d)\S+$/, {
    message: 'Password must contains uppercase and digits',
  })
  @Matches(/^(?=.*[a-z])\S+$/, {
    message: 'Password must contains lowercase',
  })
  @Matches(/^(?=.*[A-Z])\S+$/, {
    message: 'Password must contains uppercase',
  })
  @Matches(/^(?=.*\d)\S+$/, {
    message: 'Password must contains digits',
  })
  @ApiPropertyOptional()
  public password: string;

  @IsOptional()
  @Length(4, 128, { message: 'UserGroup length at least 4 characters' })
  @IsDefined({ message: 'UserGroup must be defined' })
  @IsString({ message: 'UserGroup must be string' })
  @ApiPropertyOptional()
  public userGroup: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  public isActive: boolean;
}
