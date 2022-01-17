import { IsDefined, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthMailDto {
  public static from(dto: AuthMailDto): AuthMailDto | null {
    if (dto) {
      const authMailDto = new AuthMailDto();
      authMailDto.verifyCode = dto?.verifyCode;
      return authMailDto;
    }
    return null;
  }

  @IsNotEmpty({ message: 'Verify Code is required' })
  @IsDefined({ message: 'Verify Code must be defined' })
  @IsString({ message: 'Verify Code must be string' })
  @ApiProperty()
  public verifyCode: string;
}

export class ResendAuthMailDto {
  public static from(dto: ResendAuthMailDto): ResendAuthMailDto | null {
    if (dto) {
      const resendAuthMailDto = new ResendAuthMailDto();
      resendAuthMailDto.username = dto?.username;
      return resendAuthMailDto;
    }
    return null;
  }

  @IsNotEmpty({ message: 'Username must not empty' })
  @IsDefined({ message: 'Username must be defined' })
  @IsString({ message: 'Username must be string' })
  @ApiProperty()
  public username: string;
}
