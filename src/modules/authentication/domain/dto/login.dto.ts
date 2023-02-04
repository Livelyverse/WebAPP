import {
  IsNotEmpty,
  IsDefined,
  IsString,
  Length,
  Matches, IsEmail
} from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @IsNotEmpty({ message: 'Email must not empty' })
  @IsDefined({ message: 'Email must be defined' })
  @IsEmail({ message: 'Email must be valid' })
  @ApiProperty()
  public email: string;

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
  @IsDefined({ message: 'Password must be defined' })
  @IsString({ message: 'Password must be string' })
  @ApiProperty()
  public password: string;
}
