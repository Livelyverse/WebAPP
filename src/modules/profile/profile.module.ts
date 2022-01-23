import { BadRequestException, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleController } from './controllers/role.controller';
import { GroupController } from './controllers/group.controller';
import { UserController } from './controllers/user.controller';
import { RoleService } from './services/role.service';
import { GroupService } from './services/group.service';
import { UserService } from './services/user.service';
import { GroupEntity, RoleEntity, UserEntity } from './domain/entity';
import { ContactController } from './controllers/contact.controller';
import { MailModule } from '../mail/mail.module';
import { AuthMailEntity, TokenEntity } from '../authentication/domain/entity';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoleEntity,
      GroupEntity,
      UserEntity,
      AuthMailEntity,
      TokenEntity,
    ]),
    MailModule,
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: memoryStorage(),
        // fileFilter: (request, file, callback) => {
        //   if (
        //     !file.mimetype.includes(
        //       configService.get<string>('http.upload.mimeFilter'),
        //     )
        //   ) {
        //     return callback(
        //       new BadRequestException({ message: 'Upload File Invalid' }),
        //       false,
        //     );
        //   }
        //   callback(null, true);
        // },
        limits: {
          fileSize: configService.get<number>('http.upload.sizeLimit'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    RoleController,
    GroupController,
    UserController,
    ContactController,
  ],
  providers: [RoleService, GroupService, UserService],
  exports: [RoleService, GroupService, UserService],
})
export class ProfileModule {}
