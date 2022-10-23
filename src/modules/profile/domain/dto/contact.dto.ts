import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ContactDto {
  // public static from(dto: ContactDto): ContactDto | null {
  //   if (dto) {
  //     const contractDto = new ContactDto();
  //     contractDto.name = dto?.name;
  //     contractDto.email = dto?.email;
  //     contractDto.message = dto?.message;
  //     return contractDto;
  //   }
  //   return null;
  // }

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
