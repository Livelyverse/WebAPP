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
  @Matches(/^(?=.*[a-z])|(?=.*[A-Z])|(?=.*\d)\S+$/, {
    message: 'Old password must contains lowercase, uppercase and digits',
  })
  @Matches(/^(?=.*[a-z])|(?=.*[A-Z])\S+$/, {
    message: 'Old password must contains lowercase and uppercase',
  })
  @Matches(/^(?=.*[a-z])|(?=.*\d)\S+$/, {
    message: 'Old password must contains lowercase and digits',
  })
  @Matches(/^(?=.*[A-Z])|(?=.*\d)\S+$/, {
    message: 'Old password must contains uppercase and digits',
  })
  @Matches(/^(?=.*[a-z])\S+$/, {
    message: 'Old password must contains lowercase',
  })
  @Matches(/^(?=.*[A-Z])\S+$/, {
    message: 'Old password must contains uppercase',
  })
  @Matches(/^(?=.*\d)\S+$/, {
    message: 'Old password must contains digits',
  })
  @IsDefined({ message: 'Old password must be defined' })
  @IsString({ message: 'Old password must be string' })
  @ApiProperty()
  public oldPassword: string;

  @Length(8, 128, { message: 'Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])|(?=.*[A-Z])|(?=.*\d)\S+$/, {
    message: 'New Password must contains lowercase, uppercase and digits',
  })
  @Matches(/^(?=.*[a-z])|(?=.*[A-Z])\S+$/, {
    message: 'New Password must contains lowercase and uppercase',
  })
  @Matches(/^(?=.*[a-z])|(?=.*\d)\S+$/, {
    message: 'New Password must contains lowercase and digits',
  })
  @Matches(/^(?=.*[A-Z])|(?=.*\d)\S+$/, {
    message: 'New Password must contains uppercase and digits',
  })
  @Matches(/^(?=.*[a-z])\S+$/, {
    message: 'New Password must contains lowercase',
  })
  @Matches(/^(?=.*[A-Z])\S+$/, {
    message: 'New Password must contains uppercase',
  })
  @Matches(/^(?=.*\d)\S+$/, {
    message: 'New Password must contains digits',
  })
  @IsDefined({ message: 'New Password must be defined' })
  @IsString({ message: 'New Password must be string' })
  @ApiProperty()
  public newPassword: string;
}

export class PostResetPasswordDto {
  @Length(8, 128, { message: 'New Password length at least 8 characters' })
  @Matches(/^(?=.*[a-z])|(?=.*[A-Z])|(?=.*\d)\S+$/, {
    message: 'New Password must contains lowercase, uppercase and digits',
  })
  @Matches(/^(?=.*[a-z])|(?=.*[A-Z])\S+$/, {
    message: 'New Password must contains lowercase and uppercase',
  })
  @Matches(/^(?=.*[a-z])|(?=.*\d)\S+$/, {
    message: 'New Password must contains lowercase and digits',
  })
  @Matches(/^(?=.*[A-Z])|(?=.*\d)\S+$/, {
    message: 'New Password must contains uppercase and digits',
  })
  @Matches(/^(?=.*[a-z])\S+$/, {
    message: 'New Password must contains lowercase',
  })
  @Matches(/^(?=.*[A-Z])\S+$/, {
    message: 'New Password must contains uppercase',
  })
  @Matches(/^(?=.*\d)\S+$/, {
    message: 'New Password must contains digits',
  })
  @IsDefined({ message: 'New Password must be defined' })
  @IsString({ message: 'New Password must be string' })
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
