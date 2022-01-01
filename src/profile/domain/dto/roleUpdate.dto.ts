import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDefined,
  Length, IsUUID
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleUpdateDto {
  @IsUUID()
  @ApiProperty()
  public id: string;

  @Length(4, 128, { message: 'Name length at least 4 characters' })
  @IsNotEmpty({ message: 'Name must not empty' })
  @IsDefined({ message: 'Name must be defined' })
  @IsString({ message: 'Name must be string' })
  @ApiProperty()
  public name: string;

  @IsString({ message: 'Description must be string' })
  @IsNotEmpty({ message: 'Description must not empty' })
  @IsDefined({ message: 'Description must be defined' })
  @ApiProperty()
  public description: string;
}
