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
  @Length(8, 128, { message: 'Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/, {
    message: 'Password must contains lowercase, uppercase, digit',
  })
  @ApiProperty()
  public password: string;

  @IsNotEmpty({ message: 'Email must not empty' })
  @IsDefined({ message: 'Email must be defined' })
  @IsEmail({ message: 'Email must be valid' })
  @ApiProperty()
  public email: string;
}
