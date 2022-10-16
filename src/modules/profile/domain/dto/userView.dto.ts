import { ApiPropertyOptional, ApiResponseProperty } from "@nestjs/swagger";
import { UserEntity } from '../entity';

export class UserViewDto {
  public static from(user: UserEntity): UserViewDto | null {
    if (user) {
      const userDto = new UserViewDto();
      userDto.id = user.id;
      userDto.username = user.username;
      userDto.email = user.email;
      userDto.userGroup = user.userGroup.name;
      userDto.role = user.userGroup.role.name;
      userDto.firstname = user.firstname;
      userDto.lastname = user.lastname;
      userDto.imageUrl = user.imageUrl;
      userDto.walletAddress = user.walletAddress;
      userDto.createdAt = user.createdAt;
      userDto.updatedAt = user.updatedAt;
      return userDto;
    }
    return null;
  }

  @ApiResponseProperty()
  public id: string;

  @ApiResponseProperty()
  public username: string;

  @ApiResponseProperty()
  public userGroup: string;

  @ApiResponseProperty()
  public role: string;

  @ApiResponseProperty()
  public email: string;

  @ApiResponseProperty()
  public imageUrl: string;

  @ApiResponseProperty()
  public firstname: string;

  @ApiResponseProperty()
  public lastname: string;

  @ApiPropertyOptional()
  public walletAddress: string;

  @ApiResponseProperty()
  public createdAt: Date;

  @ApiResponseProperty()
  public updatedAt: Date;
}
