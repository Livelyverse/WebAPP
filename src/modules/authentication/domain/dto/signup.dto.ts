import {
  IsEmail,
  IsString,
  Length,
  Matches,
  IsOptional,
  IsNotEmpty,
  IsDefined,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupDto {
  // public static from(dto: SignupDto): SignupDto | null {
  //   if (dto) {
  //     const signupDto = new SignupDto();
  //     signupDto.username = dto?.username;
  //     signupDto.password = dto?.password;
  //     signupDto.email = dto?.email;
  //     return signupDto;
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
  @ApiProperty()
  public password: string;

  @IsEmail({ message: 'Email must be valid' })
  @ApiProperty()
  public email: string;
}
