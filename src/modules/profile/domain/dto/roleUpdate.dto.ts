import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDefined,
  Length,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleUpdateDto {
  public static from(dto: RoleUpdateDto): RoleUpdateDto | null {
    if (dto) {
      const updateDto = new RoleUpdateDto();
      updateDto.id = dto?.id;
      updateDto.name = dto?.name;
      updateDto.description = dto?.description;
      return updateDto;
    }
    return null;
  }

  @IsUUID()
  @ApiProperty()
  public id: string;

  @Length(4, 128, { message: 'Name length at least 4 characters' })
  @IsNotEmpty({ message: 'Name must not empty' })
  @IsDefined({ message: 'Name must be defined' })
  @IsString({ message: 'Name must be string' })
  @ApiPropertyOptional()
  public name: string;

  @IsString({ message: 'Description must be string' })
  @IsNotEmpty({ message: 'Description must not empty' })
  @IsDefined({ message: 'Description must be defined' })
  @ApiPropertyOptional()
  public description: string;
}
