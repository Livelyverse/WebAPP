import {
  IsNotEmpty,
  IsDefined,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  // public static from(dto: ChangePasswordDto): ChangePasswordDto | null {
  //   if (dto) {
  //     const passwordDto = new ChangePasswordDto();
  //     passwordDto.username = dto?.username;
  //     passwordDto.newPassword = dto?.newPassword;
  //     passwordDto.oldPassword = dto?.oldPassword;
  //     return passwordDto;
  //   }
  //   return null;
  // }

  // @IsNotEmpty({ message: 'Username must not empty' })
  // @IsDefined({ message: 'Username must be defined' })
  // @IsString({ message: 'Username must be string' })
  // @ApiProperty()
  // public username: string;

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
  // public static from(dto: PostResetPasswordDto): PostResetPasswordDto | null {
  //   if (dto) {
  //     const resetPasswordDto = new PostResetPasswordDto();
  //     resetPasswordDto.newPassword = dto?.newPassword;
  //     return resetPasswordDto;
  //   }
  //   return null;
  // }

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
