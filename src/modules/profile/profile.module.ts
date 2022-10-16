import { BadRequestException, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleController } from './controllers/role.controller';
import { UserGroupController } from './controllers/userGroup.controller';
import { UserController } from './controllers/user.controller';
import { RoleService } from './services/role.service';
import { UserGroupService } from './services/userGroup.service';
import { UserService } from './services/user.service';
import { UserGroupEntity, RoleEntity, UserEntity } from './domain/entity';
import { ContactController } from './controllers/contact.controller';
import { MailModule } from '../mail/mail.module';
import { AuthMailEntity, AuthTokenEntity } from '../authentication/domain/entity';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { BackofficeController } from './controllers/dashboard.controller';
import { SocialProfileEntity } from "./domain/entity";
import { SocialProfileController } from "./controllers/socialProfile.controller";
import { SocialProfileService } from "./services/socialProfile.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoleEntity,
      UserGroupEntity,
      UserEntity,
      AuthMailEntity,
      AuthTokenEntity,
      SocialProfileEntity,
    ]),
    MailModule,
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: memoryStorage(),
        fileFilter: (request, file, callback) => {
          if (
            !file.mimetype.includes(
              configService.get<string>('http.upload.mimeFilter'),
            )
          ) {
            return callback(
              new BadRequestException({ message: 'Upload File Invalid' }),
              false,
            );
          }
          callback(null, true);
        },
        limits: {
          fileSize: configService.get<number>('http.upload.sizeLimit'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    RoleController,
    UserGroupController,
    UserController,
    ContactController,
    SocialProfileController,
    BackofficeController,
  ],
  providers: [RoleService, UserGroupService, UserService, SocialProfileService],
  exports: [RoleService, UserGroupService, UserService, SocialProfileService],
})
export class ProfileModule {}
