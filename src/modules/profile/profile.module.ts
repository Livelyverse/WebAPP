import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([RoleEntity, GroupEntity, UserEntity]),
    MailModule,
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
