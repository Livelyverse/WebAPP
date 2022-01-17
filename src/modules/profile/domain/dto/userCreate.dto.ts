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
  public static from(dto: UserCreateDto): UserCreateDto | null {
    if (dto) {
      const createDto = new UserCreateDto();
      createDto.username = dto?.username;
      createDto.password = dto?.password;
      createDto.email = dto?.email;
      createDto.group = dto?.group;
      createDto.firstname = dto?.firstname;
      createDto.lastname = dto?.lastname;
      return createDto;
    }
    return null;
  }

  @IsNotEmpty({ message: 'Username must not empty' })
  @IsDefined({ message: 'Username must be defined' })
  @IsString({ message: 'Username must be string' })
  @ApiProperty()
  public username: string;

  @IsEmail({ message: 'Email must be valid' })
  @ApiProperty()
  public email: string;

  @Length(8, 128, { message: 'Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/, {
    message: 'Password must contains lowercase, uppercase, digit',
  })
  @ApiProperty()
  public password: string;

  @Length(4, 128, { message: 'Group length at least 4 characters' })
  @IsNotEmpty({ message: 'Group must not empty' })
  @IsDefined({ message: 'Group must be defined' })
  @IsString({ message: 'Group must be string' })
  @ApiProperty()
  public group: string;

  @IsOptional()
  @IsString({ message: 'firstname must be string' })
  @ApiPropertyOptional()
  public firstname: string;

  @IsString({ message: 'lastname must be string' })
  @IsOptional()
  @ApiPropertyOptional()
  public lastname: string;
}
