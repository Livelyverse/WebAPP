import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserEntity } from '../entity/user.entity';

export class UserViewDto {
  public static from(user: UserEntity): UserViewDto | null {
    if (user) {
      const userDto = new UserViewDto();
      userDto.id = user.id;
      userDto.username = user.username;
      userDto.email = user.email;
      userDto.firstname = user.firstname;
      userDto.lastname = user.lastname;
      userDto.walletAddress = user.walletAddress;
      userDto.createdAt = user.createdAt;
      userDto.updatedAt = user.updatedAt;
      return userDto;
    }
    return null;
  }

  @ApiProperty()
  public id: string;

  @ApiProperty()
  public username: string;

  @ApiProperty()
  public email: string;

  @ApiPropertyOptional()
  public firstname?: string;

  @ApiPropertyOptional()
  public lastname?: string;

  @ApiPropertyOptional()
  public walletAddress?: string;

  @ApiProperty()
  public createdAt: Date;

  @ApiProperty()
  public updatedAt: Date;
}
