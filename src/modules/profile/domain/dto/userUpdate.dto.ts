import {
  IsEmail,
  IsNotEmpty,
  IsDefined,
  IsString,
  Length,
  Matches,
  IsDate,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserUpdateDto {
  public static from(dto: UserUpdateDto): UserUpdateDto | null {
    if (dto) {
      const updateDto = new UserUpdateDto();
      updateDto.id = dto?.id;
      updateDto.username = dto?.username;
      updateDto.email = dto?.email;
      updateDto.imageUrl = dto?.imageUrl;
      updateDto.firstname = dto?.firstname;
      updateDto.lastname = dto?.lastname;
      updateDto.walletAddress = dto?.walletAddress;
    }
    return null;
  }

  @IsUUID()
  @ApiProperty()
  public id: string;

  @IsNotEmpty({ message: 'Username must not empty' })
  @IsDefined({ message: 'Username must be defined' })
  @IsString({ message: 'Username must be string' })
  @ApiPropertyOptional()
  public username?: string;

  @IsEmail({ message: 'Email must be valid' })
  @IsNotEmpty({ message: 'Email must not empty' })
  @IsDefined({ message: 'Email must be defined' })
  @IsString({ message: 'Email must be string' })
  @ApiPropertyOptional()
  public email?: string;

  @IsOptional()
  @ApiPropertyOptional()
  public imageUrl?: string;

  @IsOptional()
  // @Matches(/^0x.*$/)
  @ApiPropertyOptional()
  public walletAddress?: string;

  @IsOptional()
  @ApiPropertyOptional()
  public firstname?: string;

  @IsOptional()
  @ApiPropertyOptional()
  public lastname?: string;
}
