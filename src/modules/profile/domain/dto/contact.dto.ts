import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ContactDto {
  @IsNotEmpty({ message: 'Name must not empty' })
  @IsDefined({ message: 'Name must be defined' })
  @IsString({ message: 'Name must be string' })
  @ApiProperty()
  public name: string;

  @IsEmail({ message: 'Email must be valid' })
  @ApiProperty()
  public email: string;

  @Length(4, 1024, { message: 'Message length Invalid' })
  @IsNotEmpty({ message: 'Message must not empty' })
  @IsDefined({ message: 'Message must be defined' })
  @IsString({ message: 'Message must be string' })
  @ApiProperty()
  public message: string;
}
