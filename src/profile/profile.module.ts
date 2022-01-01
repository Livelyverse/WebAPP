import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from './domain/entity/role.entity';
import { GroupEntity } from './domain/entity/group.entity';
import { UserEntity } from './domain/entity/user.entity';
import { RoleController } from './controllers/role.controller';
import { GroupController } from './controllers/group.controller';
import { UserController } from './controllers/user.controller';
import { RoleService } from './services/role.service';
import { GroupService } from './services/group.service';
import { UserService } from './services/user.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, GroupEntity, UserEntity])],
  controllers: [RoleController, GroupController, UserController],
  providers: [RoleService, GroupService, UserService],
  exports: [RoleService, GroupService, UserService],
})
export class ProfileModule {}
