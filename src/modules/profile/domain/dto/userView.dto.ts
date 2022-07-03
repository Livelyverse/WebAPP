import { ApiProperty, ApiPropertyOptional, ApiResponseProperty } from "@nestjs/swagger";
import { UserEntity } from '../entity';
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";

export class UserViewDto {
  public static from(user: UserEntity): UserViewDto | null {
    if (user) {
      const userDto = new UserViewDto();
      userDto.id = user.id;
      userDto.username = user.username;
      userDto.email = user.email;
      userDto.group = user.group.name;
      userDto.role = user.group.role.name;
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

  @ApiProperty()
  public id: string;

  @ApiResponseProperty()
  public username: string;

  @ApiResponseProperty()
  public group: string;

  @ApiResponseProperty()
  public role: string;

  @ApiResponseProperty()
  public email: string;

  @ApiResponseProperty()
  public imageUrl?: string;

  @ApiResponseProperty()
  public firstname?: string;

  @ApiResponseProperty()
  public lastname?: string;

  @ApiPropertyOptional()
  public walletAddress?: string;

  @ApiResponseProperty()
  public createdAt: Date;

  @ApiResponseProperty()
  public updatedAt: Date;
}
