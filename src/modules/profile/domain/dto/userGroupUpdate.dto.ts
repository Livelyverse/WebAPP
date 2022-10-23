import {
  IsString,
  IsNotEmpty,
  IsDefined,
  Length,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserGroupUpdateDto {
  // public static from(dto: UserGroupUpdateDto): UserGroupUpdateDto | null {
  //   if (dto) {
  //     const updateDto = new UserGroupUpdateDto();
  //     updateDto.id = dto?.id;
  //     updateDto.name = dto?.name;
  //     updateDto.role = dto?.role;
  //     updateDto.description = dto?.description;
  //     return updateDto;
  //   }
  //   return null;
  // }

  @IsUUID()
  @ApiProperty()
  public id: string;

  @Length(4, 128, { message: 'Name length at least 4 characters' })
  @IsNotEmpty({ message: 'Name must not empty' })
  @IsDefined({ message: 'Name must be defined' })
  @IsString({ message: 'Name must be string' })
  @ApiPropertyOptional()
  public name: string;

  @Length(4, 128, { message: 'Role length at least 4 characters' })
  @IsNotEmpty({ message: 'Role must not empty' })
  @IsDefined({ message: 'Role must be defined' })
  @IsString({ message: 'Role must be string' })
  @ApiPropertyOptional()
  public role: string;

  @IsString({ message: 'Description must be string' })
  @IsNotEmpty({ message: 'Description must not empty' })
  @IsDefined({ message: 'Description must be defined' })
  @ApiPropertyOptional()
  public description: string;
}
