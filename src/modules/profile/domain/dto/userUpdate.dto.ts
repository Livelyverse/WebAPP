import {
  IsNotEmpty,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UserUpdateDto {
  // public static from(dto: UserUpdateDto): UserUpdateDto | null {
  //   if (dto) {
  //     const updateDto = new UserUpdateDto();
  //     updateDto.username = dto?.username;
  //     updateDto.firstname = dto?.firstname;
  //     updateDto.lastname = dto?.lastname;
  //     updateDto.walletAddress = dto?.walletAddress;
  //     return updateDto;
  //   }
  //   return null;
  // }

  // @IsOptional()
  // @IsNotEmpty({ message: 'Username must not empty' })
  // @IsString({ message: 'Username must be string' })
  // @ApiPropertyOptional()
  // public username?: string;

  @IsOptional()
  @ApiPropertyOptional()
  public walletAddress: string;

  @IsOptional()
  @ApiPropertyOptional()
  public firstname: string;

  @IsOptional()
  @ApiPropertyOptional()
  public lastname: string;
}
