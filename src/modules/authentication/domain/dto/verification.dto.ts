import { IsDefined, IsEmail, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class AuthMailDto {
  @IsNotEmpty({ message: 'Verify Code is required' })
  @IsDefined({ message: 'Verify Code must be defined' })
  @IsString({ message: 'Verify Code must be string' })
  @ApiProperty()
  public verifyCode: string;
}

export class ResendAuthMailDto {
  @IsNotEmpty({ message: 'Email must not empty' })
  @IsDefined({ message: 'Email must be defined' })
  @IsEmail({ message: 'Email must be valid' })
  @ApiProperty()
  public email: string;
}
