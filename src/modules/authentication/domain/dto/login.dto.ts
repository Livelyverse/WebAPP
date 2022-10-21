import {
  IsNotEmpty,
  IsDefined,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  // public static from(dto: LoginDto): LoginDto | null {
  //   if (dto) {
  //     const loginDto = new LoginDto();
  //     loginDto.username = dto?.username;
  //     loginDto.password = dto?.password;
  //     return loginDto;
  //   }
  //   return null;
  // }

  @IsNotEmpty({ message: 'Username must not empty' })
  @IsDefined({ message: 'Username must be defined' })
  @IsString({ message: 'Username must be string' })
  @ApiProperty()
  public username: string;

  @Length(8, 128, { message: 'Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/, {
    message: 'Password must contains lowercase, uppercase, digit',
  })
  @IsDefined({ message: 'Password must be defined' })
  @IsString({ message: 'Password must be string' })
  @ApiProperty()
  public password: string;
}
