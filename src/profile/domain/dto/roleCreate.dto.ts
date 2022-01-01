import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDefined,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleCreateDto {
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
