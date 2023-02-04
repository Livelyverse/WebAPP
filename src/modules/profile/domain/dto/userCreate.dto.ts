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

export class UserCreateDto {
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
  @ApiProperty()
  public password: string;

  @Length(4, 128, { message: 'UserGroup length at least 4 characters' })
  @IsNotEmpty({ message: 'UserGroup must not empty' })
  @IsDefined({ message: 'UserGroup must be defined' })
  @IsString({ message: 'UserGroup must be string' })
  @ApiProperty()
  public userGroup: string;

  @IsOptional()
  @IsString({ message: 'fullName must be string' })
  @ApiPropertyOptional()
  public fullName: string;
}
