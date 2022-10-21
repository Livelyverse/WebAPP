import { IsDefined, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  // public static from(dto: RefreshDto): RefreshDto | null {
  //   if (dto) {
  //     const refreshDto = new RefreshDto();
  //     refreshDto.refresh_token = dto?.refresh_token;
  //     return refreshDto;
  //   }
  //   return null;
  // }

  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsDefined({ message: 'Refresh token be defined' })
  @IsString({ message: 'Refresh token be string' })
  @ApiProperty()
  public refresh_token: string;
}
