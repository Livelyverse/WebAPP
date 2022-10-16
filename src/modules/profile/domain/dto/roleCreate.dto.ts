import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDefined,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleCreateDto {
  // public static from(dto: RoleCreateDto): RoleCreateDto | null {
  //   if (dto) {
  //     const createDto = new RoleCreateDto();
  //     createDto.name = dto?.name;
  //     createDto.description = dto?.description;
  //     return createDto;
  //   }
  //   return null;
  // }

  @Length(4, 128, { message: 'Name length at least 4 characters' })
  @IsNotEmpty({ message: 'Name must not empty' })
  @IsDefined({ message: 'Name must be defined' })
  @IsString({ message: 'Name must be string' })
  @ApiProperty()
  public name: string;

  @IsString({ message: 'Description must be string' })
  @IsOptional()
  @ApiPropertyOptional()
  public description: string;
}
