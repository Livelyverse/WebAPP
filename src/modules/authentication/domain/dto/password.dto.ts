import {
  IsNotEmpty,
  IsDefined,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @Length(8, 128, { message: 'Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/, {
    message: 'Password must contains lowercase, uppercase, digit',
  })
  @IsDefined({ message: 'Password must be defined' })
  @IsString({ message: 'Password must be string' })
  @ApiProperty()
  public oldPassword: string;

  @Length(8, 128, { message: 'Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/, {
    message: 'Password must contains lowercase, uppercase, digit',
  })
  @IsDefined({ message: 'Password must be defined' })
  @IsString({ message: 'Password must be string' })
  @ApiProperty()
  public newPassword: string;
}

export class PostResetPasswordDto {
  @Length(8, 128, { message: 'Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/, {
    message: 'Password must contains lowercase, uppercase, digit',
  })
  @IsDefined({ message: 'Password must be defined' })
  @IsString({ message: 'Password must be string' })
  @ApiProperty()
  public newPassword: string;
}

export class GetResetPasswordDto {
  public static from(
    resetPasswordDto: GetResetPasswordDto,
  ): GetResetPasswordDto | null {
    if (resetPasswordDto) {
      const dto = new GetResetPasswordDto();
      dto.id = resetPasswordDto.id;
      dto.email = resetPasswordDto.email;
      dto.resetPasswordId = resetPasswordDto.resetPasswordId;
      return dto;
    }
    return null;
  }

  @ApiProperty()
  public id: string;

  @ApiProperty()
  public email: string;

  @ApiProperty()
  public resetPasswordId: string;
}
