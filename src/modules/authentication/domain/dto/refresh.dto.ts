import { IsDefined, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsDefined({ message: 'Refresh token be defined' })
  @IsString({ message: 'Refresh token be string' })
  @ApiProperty()
  public refresh_token: string;
}
