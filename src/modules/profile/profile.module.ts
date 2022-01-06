import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleController } from './controllers/role.controller';
import { GroupController } from './controllers/group.controller';
import { UserController } from './controllers/user.controller';
import { RoleService } from './services/role.service';
import { GroupService } from './services/group.service';
import { UserService } from './services/user.service';
import { GroupEntity, RoleEntity, UserEntity } from './domain/entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, GroupEntity, UserEntity])],
  controllers: [RoleController, GroupController, UserController],
  providers: [RoleService, GroupService, UserService],
  exports: [RoleService, GroupService, UserService],
})
export class ProfileModule {}
