import { IsDefined, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthMailDto {
  @IsNotEmpty({ message: 'Verify Code is required' })
  @IsDefined({ message: 'Verify Code must be defined' })
  @IsString({ message: 'Verify Code must be string' })
  @ApiProperty()
  public readonly verifyCode: string;
}

export class ResendAuthMailDto {
  @IsNotEmpty({ message: 'Username must not empty' })
  @IsDefined({ message: 'Username must be defined' })
  @IsString({ message: 'Username must be string' })
  @ApiProperty()
  public readonly username: string;
}
